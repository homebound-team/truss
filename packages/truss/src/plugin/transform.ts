import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { basename, resolve } from "path";
import { type DiagnosticOptions, type TrussMapping, type ResolvedSegment } from "./types";
import { chainSegments, resolveFullChain, type CssChainReferenceResolver, type ResolvedChain } from "./resolve-chain";
import { generate, parseModule, traverse } from "./babel-utils";
import {
  extractChain,
  extractDollarChain,
  findCssBuilderBinding,
  findCssImportBinding,
  findImportDeclaration,
  findNamedImportBinding,
  insertAfterLeadingImports,
  isCssMethodCall,
  removeCssImport,
  replaceCssImportWithNamedImports,
  reservePreferredName,
  unwrapExpression,
  upsertNamedImports,
  type NamedImport,
} from "./ast-utils";
import { applyReferencedKeyframes } from "./at-rule-refs";
import { collectAtomicRules, generateCssData, type AtomicRule } from "./emit-css";
import { serializeTrussCss } from "./truss-css";
import { createTestCssPayload, splitArbitraryCss } from "./test-css";
import { transformCssAst } from "./transform-css";
import { buildMaybeIncDeclaration, buildRuntimeLookupDeclaration } from "./emit-style-hash";
import { Diagnostic } from "./diagnostic";
import { rewriteCssTsImports } from "./rewrite-css-ts-imports";
import {
  rewriteExpressionSites,
  type ExpressionSite,
  type RuntimeHelperName,
  type RuntimeHelpers,
} from "./rewrite-sites";

export interface TransformResult {
  code: string;
  map?: unknown;
  /** The atomic CSS generated from this file's Truss expressions. */
  css: string;
  /** The atomic CSS rules collected during this transform, keyed by class name. */
  rules: Map<string, AtomicRule>;
  /** Bare .css imports depend on whether a matching .css.ts exists, not just this source text. */
  cssImportDependencies?: ReadonlyMap<string, boolean>;
  /** Selector-based CSS extracted from a .css.ts file, including an empty stylesheet. */
  arbitraryCss?: string;
}

export interface TransformTrussOptions extends DiagnosticOptions {
  debug?: boolean;
  /** When true, inject `__injectTrussCSS(payload)` call for jsdom/test environments. */
  injectCss?: boolean;
  /** Vite can rewrite CSS side-effect imports in the same parse as Truss expressions. */
  rewriteCssImports?: boolean;
  /** Import the test CSS bootstrap even when a file has no local Truss expressions. */
  bootstrapImport?: string;
  /** The session can reuse selector-based CSS already compiled from this exact source. */
  cachedArbitraryCss?: string;
}

const RUNTIME_MODULE = "@homebound/truss/runtime";

/** Runtime imports are emitted in this order regardless of which helper the rewrite reached first. */
const RUNTIME_HELPER_ORDER: RuntimeHelperName[] = ["trussProps", "mergeProps", "TrussDebugInfo", "maybeCssVar"];

/**
 * Transform a file's CSS imports, Truss expressions, and test injections using one AST.
 *
 * .css.ts files contribute selector-based CSS while keeping their runtime exports.
 * Returns null when neither the JavaScript nor the CSS registry needs an update.
 */
export function transformTruss(
  code: string,
  filename: string,
  mapping: TrussMapping,
  options: TransformTrussOptions = {},
): TransformResult | null {
  const hasExpressions = code.includes("Css") || code.includes("css=");
  const isArbitraryCss = filename.endsWith(".css.ts");
  const mayRewriteImports = options.rewriteCssImports && code.includes(".css");
  if (!hasExpressions && !isArbitraryCss && !mayRewriteImports && !options.bootstrapImport) return null;

  const ast = parseModule(code, filename);
  const imports = mayRewriteImports ? rewriteCssTsImports(ast, filename) : undefined;
  let changed = imports?.changed ?? false;

  // Vitest loads application modules directly rather than through the app's HTML entry.
  // ESM caching evaluates this bootstrap once per graph; per-file injections dedupe rules.
  const hasBootstrapImport =
    options.bootstrapImport &&
    ast.program.body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        node.source.value === options.bootstrapImport &&
        node.importKind !== "type" &&
        node.specifiers.length === 0,
    );
  if (options.bootstrapImport && !hasBootstrapImport) {
    ast.program.body.push(t.importDeclaration([], t.stringLiteral(options.bootstrapImport)));
    changed = true;
  }

  let expressions: Pick<TransformResult, "css" | "rules"> | null = null;
  let arbitraryCss: string | undefined;
  if (isArbitraryCss) {
    arbitraryCss = options.cachedArbitraryCss ?? transformCssAst(ast, filename, mapping, options).trim();
    if (options.injectCss) {
      appendTestCssInjection(ast, filename, arbitraryCss);
      changed = true;
    }
  } else if (hasExpressions) {
    expressions = compileExpressions(ast, filename, mapping, options);
    changed ||= expressions !== null;
  }

  if (!changed && arbitraryCss === undefined) return null;
  const output = changed
    ? generate(ast, { sourceFileName: filename, sourceMaps: true, retainLines: false })
    : { code, map: undefined };
  return {
    code: changed ? preserveBlankLineAfterImports(code, output.code) : code,
    map: output.map,
    get css() {
      return expressions?.css ?? "";
    },
    rules: expressions?.rules ?? new Map(),
    cssImportDependencies: imports?.dependencies,
    arbitraryCss,
  };
}

/**
 * Rewrite Truss expressions in the shared AST and collect their atomic rules.
 *
 * An import rewrite or test bootstrap alone does not prove the Css binding can be removed;
 * leave it intact when there are no expressions, i.e. a file that re-exports Css.
 */
function compileExpressions(
  ast: t.File,
  filename: string,
  mapping: TrussMapping,
  options: TransformTrussOptions,
): Pick<TransformResult, "css" | "rules"> | null {
  // Step 1: Find the Css binding name — either from an import or a local `new CssBuilder(...)` declaration.
  // May be null when the file only has JSX css= attributes without importing Css.
  const cssImportBinding = findCssImportBinding(ast);
  const cssBindingName = cssImportBinding ?? findCssBuilderBinding(ast);

  // Step 2: Collect all Css.*.$  expression sites AND detect Css.props() / JSX css= in a single pass.
  const sites: ExpressionSite[] = [];
  const cssAttributes: NodePath<t.JSXAttribute>[] = [];
  const errorMessages: Array<{ message: string; line: number | null }> = [];
  let hasCssPropsCall = false;
  // Module-scope names, so injected helpers and imports can avoid collisions
  const usedTopLevelNames = new Set(
    ast.program.body.flatMap((node) => Object.keys(t.getOuterBindingIdentifiers(node))),
  );
  const needsScope = hasWhenCall(ast);

  traverse(ast, {
    // Scope crawling registers every binding/reference in the whole component, even though
    // only when() references need lexical lookup. Ordinary chains do not need this work.
    noScope: !needsScope,
    VariableDeclaration(path: NodePath<t.VariableDeclaration>) {
      // `var` inside a module-level block still collides with injected module helpers.
      if (path.node.kind === "var" && !path.getFunctionParent()) {
        for (const name of Object.keys(t.getOuterBindingIdentifiers(path.node))) usedTopLevelNames.add(name);
      }
    },
    // -- Css.*.$  chain collection --
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (!cssBindingName) return;

      const chain = extractDollarChain(path.node, cssBindingName);
      if (!chain) return;
      if (isInsideWhenObjectValue(path, cssBindingName)) {
        return;
      }

      const parentPath = path.parentPath;
      if (parentPath && parentPath.isMemberExpression() && t.isIdentifier(parentPath.node.property, { name: "$" })) {
        return;
      }

      const resolveCssChainReference = buildCssChainReferenceResolver(path, cssBindingName);
      const resolvedChain = resolveFullChain(
        {
          mapping,
          cssBindingName,
          resolveCssChainReference,
        },
        chain,
      );
      sites.push({ path, resolvedChain });

      const line = path.node.loc?.start.line ?? null;
      for (const err of resolvedChain.errors) {
        options.onDiagnostic?.(new Diagnostic(err, filename, path.node));
        errorMessages.push({ message: err, line });
      }
    },
    // -- Css.props() detection (so we don't bail early when there are no Css.*.$ sites) --
    CallExpression(path: NodePath<t.CallExpression>) {
      if (cssBindingName && isCssMethodCall(path.node, cssBindingName, "props")) {
        hasCssPropsCall = true;
      }
    },
    // -- JSX css={...} attribute detection (so we don't bail when there are only css props) --
    // Collect in normal traversal order. Replacing an attribute reuses its expression nodes,
    // so nested attributes remain reachable through their collected paths. Cases that clone
    // expressions instead use rewriteExpressionSites' follow-up traversal of the new nodes.
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      cssAttributes.push(path);
    },
  });

  if (sites.length === 0 && !hasCssPropsCall && cssAttributes.length === 0) {
    return null;
  }

  // Step 3: Collect atomic rules for CSS generation
  const chains = sites.map((s) => s.resolvedChain);
  const { rules, needsMaybeInc, needsMaybeCssVar } = collectAtomicRules(chains, mapping);
  // Vite consumes rules and serializes the combined stylesheet once. Standalone callers
  // can still read `css`, but do not make every module pay for unused CSS serialization.
  let cssText: string | undefined;
  /** Build per-module CSS only when a standalone caller or test injection consumes it. */
  function collectCssData() {
    const cssData = generateCssData(rules);
    // Each test module carries the keyframes its own rules name; production merges them once.
    applyReferencedKeyframes(cssData, mapping);
    return cssData;
  }

  // Step 4: Reserve local names for injected helpers
  const runtime = createRuntimeHelpers(ast, usedTopLevelNames);
  const maybeIncHelperName = needsMaybeInc ? reservePreferredName(usedTopLevelNames, "__maybeInc") : null;
  const maybeCssVarHelperName = needsMaybeCssVar ? runtime.use("maybeCssVar") : null;

  // Collect typography runtime lookups
  const runtimeLookups = collectRuntimeLookups(chains);
  const runtimeLookupNames = new Map<string, string>();
  for (const lookupKey of runtimeLookups.keys()) {
    runtimeLookupNames.set(lookupKey, reservePreferredName(usedTopLevelNames, `__${lookupKey}`));
  }

  // Step 5: Rewrite Css sites in-place
  rewriteExpressionSites({
    ast,
    sites,
    cssBindingName,
    filename: basename(filename),
    debug: options.debug ?? false,
    mapping,
    maybeIncHelperName,
    maybeCssVarHelperName,
    runtime,
    runtimeLookupNames,
    hasCssPropsCall,
    cssAttributes,
  });

  // Step 6: Prepare runtime imports before removing the Css import.
  const runtimeImports = runtime.imports();
  if (options.injectCss) {
    runtimeImports.push({ importedName: "__injectTrussCSS", localName: "__injectTrussCSS" });
  }

  // Step 7: Remove/replace the Css import and inject runtime imports.
  // When Css comes from a local `new CssBuilder(...)` (tsup bundles), skip import removal.
  let reusedCssImportLine = false;
  if (cssImportBinding) {
    reusedCssImportLine =
      runtimeImports.length > 0 &&
      findImportDeclaration(ast, RUNTIME_MODULE) === null &&
      replaceCssImportWithNamedImports(ast, cssImportBinding, RUNTIME_MODULE, runtimeImports);

    if (!reusedCssImportLine) {
      removeCssImport(ast, cssImportBinding);
    }
  }

  if (!reusedCssImportLine) {
    upsertNamedImports(ast, RUNTIME_MODULE, runtimeImports);
  }

  // Step 8: Insert helper declarations after imports
  const declarationsToInsert: t.Statement[] = [];
  if (maybeIncHelperName) {
    declarationsToInsert.push(buildMaybeIncDeclaration(maybeIncHelperName));
  }
  // Insert runtime lookup tables for typography
  for (const [lookupKey, segmentsByName] of runtimeLookups) {
    const lookupName = runtimeLookupNames.get(lookupKey);
    if (!lookupName) continue;
    declarationsToInsert.push(buildRuntimeLookupDeclaration(lookupName, segmentsByName, mapping));
  }

  // Inject __injectTrussCSS call if requested
  if (options.injectCss && rules.size > 0) {
    declarationsToInsert.push(
      t.expressionStatement(
        t.callExpression(t.identifier("__injectTrussCSS"), [t.valueToNode(createTestCssPayload(collectCssData()))]),
      ),
    );
  }

  // Emit console.error calls for any unsupported patterns
  for (const { message, line } of errorMessages) {
    const location = line !== null ? `${filename}:${line}` : filename;
    const logMessage = `${message} (${location})`;
    declarationsToInsert.push(
      t.expressionStatement(
        t.callExpression(t.memberExpression(t.identifier("console"), t.identifier("error")), [
          t.stringLiteral(logMessage),
        ]),
      ),
    );
  }

  insertAfterLeadingImports(ast, declarationsToInsert);

  return {
    get css() {
      return (cssText ??= serializeTrussCss(collectCssData()));
    },
    rules,
  };
}

/**
 * Append an __injectTrussCSS call so a .css.ts file delivers its compiled CSS when it
 * evaluates in tests, including through dynamic imports the import rewrite cannot see.
 *
 * Reuses an existing runtime import of the helper, otherwise reserves a collision-free local
 * name, so an exported __injectTrussCSS binding in the file still works.
 */
function appendTestCssInjection(ast: t.File, fileId: string, css: string): void {
  // Module-scope names, so the injected import can avoid collisions.
  let usedTopLevelNames = new Set<string>();
  traverse(ast, {
    Program(path) {
      usedTopLevelNames = new Set(Object.keys(path.scope.bindings));
      path.stop();
    },
  });
  const importedName = "__injectTrussCSS";
  const existing = findNamedImportBinding(ast, importedName, RUNTIME_MODULE);
  const localName = existing ?? reservePreferredName(usedTopLevelNames, importedName);
  if (!existing) upsertNamedImports(ast, RUNTIME_MODULE, [{ importedName, localName }]);
  ast.program.body.push(
    t.expressionStatement(
      t.callExpression(t.identifier(localName), [
        t.valueToNode({ arbitraryRules: splitArbitraryCss(css), source: resolve(fileId).replace(/\\/g, "/") }),
      ]),
    ),
  );
}

/**
 * Track which `@homebound/truss/runtime` helpers the rewrite ends up calling.
 *
 * `use()` reuses an existing import's local name when the module already imports the helper,
 * otherwise reserves a collision-free local name; `imports()` lists the helpers that still
 * need an import statement, in canonical order.
 */
function createRuntimeHelpers(
  ast: t.File,
  usedTopLevelNames: Set<string>,
): RuntimeHelpers & { imports(): NamedImport[] } {
  const localNames = new Map<RuntimeHelperName, string>();
  const missingImports = new Map<RuntimeHelperName, NamedImport>();

  return {
    use(name) {
      let localName = localNames.get(name);
      if (localName === undefined) {
        const existing = findNamedImportBinding(ast, name, RUNTIME_MODULE);
        localName = existing ?? reservePreferredName(usedTopLevelNames, name);
        if (!existing) missingImports.set(name, { importedName: name, localName });
        localNames.set(name, localName);
      }
      return localName;
    },
    imports() {
      return RUNTIME_HELPER_ORDER.flatMap((name) => {
        const entry = missingImports.get(name);
        return entry ? [entry] : [];
      });
    },
  };
}

/** True when `path` sits inside the object literal of a `Css.…when({ ... })` call, whose values are resolved by the outer chain. */
function isInsideWhenObjectValue(path: NodePath<t.MemberExpression>, cssBindingName: string): boolean {
  let current: NodePath<t.Node> | null = path.parentPath;

  while (current) {
    if (current.isObjectExpression()) {
      const parent = current.parentPath;
      if (
        parent?.isCallExpression() &&
        parent.node.arguments[0] === current.node &&
        t.isMemberExpression(parent.node.callee) &&
        !parent.node.callee.computed &&
        t.isIdentifier(parent.node.callee.property, { name: "when" }) &&
        extractChain(parent.node.callee.object as t.Expression, cssBindingName)
      ) {
        return true;
      }
    }

    current = current.parentPath;
  }

  return false;
}

function buildCssChainReferenceResolver(
  path: NodePath<t.MemberExpression>,
  cssBindingName: string,
): CssChainReferenceResolver {
  return (node) => {
    return resolveCssChainReference(path, node, cssBindingName, new Set<string>());
  };
}

/**
 * Follow lexical bindings like `const same = Css.blue.$` back to their original
 * `Css.*.$` expression so `when({ ":hover": same })` can resolve the same as
 * an inline value. This stays in the transform layer because it depends on Babel
 * scope/NodePath lookup, not just chain semantics.
 */
function resolveCssChainReference(
  path: NodePath<t.Node>,
  node: t.Expression,
  cssBindingName: string,
  seen: Set<string>,
): ReturnType<typeof extractChain> {
  const value = unwrapExpression(node);

  if (t.isMemberExpression(value)) {
    return extractDollarChain(value, cssBindingName);
  }

  if (!t.isIdentifier(value) || seen.has(value.name)) {
    return null;
  }

  const binding = path.scope.getBinding(value.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator()) {
    return null;
  }

  const init = binding.path.node.init;
  if (!init || !t.isExpression(init)) {
    return null;
  }

  seen.add(value.name);
  return resolveCssChainReference(binding.path, init, cssBindingName, seen);
}

/** Conservatively enable lexical bindings for when(), including escaped/computed method names. */
function hasWhenCall(ast: t.File): boolean {
  let found = false;
  t.traverseFast(ast, (node) => {
    if (!t.isCallExpression(node) || !t.isMemberExpression(node.callee)) return;
    const property = node.callee.property;
    if (t.isIdentifier(property, { name: "when" }) || t.isStringLiteral(property, { value: "when" })) found = true;
  });
  return found;
}

/** Collect typography runtime lookups from all resolved chains, keyed by lookup name. */
function collectRuntimeLookups(chains: ResolvedChain[]): Map<string, Record<string, ResolvedSegment[]>> {
  const lookups = new Map<string, Record<string, ResolvedSegment[]>>();
  for (const seg of chains.flatMap((chain) => chainSegments(chain))) {
    if (seg.kind === "typography" && !lookups.has(seg.lookupKey)) {
      lookups.set(seg.lookupKey, seg.segmentsByName);
    }
  }
  return lookups;
}

/** Babel's generator drops the blank line after the import block; put it back when the source had one. */
function preserveBlankLineAfterImports(input: string, output: string): string {
  const inputLines = input.split("\n");
  const outputLines = output.split("\n");
  const lastInputImportLine = findLastImportLine(inputLines);
  const lastOutputImportLine = findLastImportLine(outputLines);

  if (lastInputImportLine === -1 || lastOutputImportLine === -1) {
    return output;
  }

  const inputHasBlankLineAfterImports = inputLines[lastInputImportLine + 1]?.trim() === "";
  const outputHasBlankLineAfterImports = outputLines[lastOutputImportLine + 1]?.trim() === "";
  if (!inputHasBlankLineAfterImports || outputHasBlankLineAfterImports) {
    return output;
  }

  outputLines.splice(lastOutputImportLine + 1, 0, "");
  return outputLines.join("\n");
}

function findLastImportLine(lines: string[]): number {
  let lastImportLine = -1;
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trimStart().startsWith("import ")) {
      lastImportLine = index;
    }
  }
  return lastImportLine;
}
