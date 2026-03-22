## [2.1.0-next.9](https://github.com/homebound-team/truss/compare/v2.1.0-next.8...v2.1.0-next.9) (2026-03-22)

### Bug Fixes

* Use stylex's priority system. ([9de204c](https://github.com/homebound-team/truss/commit/9de204c73833784a7ba11e87b976bc615377cc31))

## [2.1.0-next.8](https://github.com/homebound-team/truss/compare/v2.1.0-next.7...v2.1.0-next.8) (2026-03-22)

### Bug Fixes

* Another attempt at ordering fix. ([ba9fc8a](https://github.com/homebound-team/truss/commit/ba9fc8a868d90df10101afc8515c1c81e4f8d596))

## [2.1.0-next.7](https://github.com/homebound-team/truss/compare/v2.1.0-next.6...v2.1.0-next.7) (2026-03-22)

### Bug Fixes

* Fix variable rules emit after static. ([ceb5e52](https://github.com/homebound-team/truss/commit/ceb5e521013c5538cb396817f43e1ad73b0cc511))

## [2.1.0-next.6](https://github.com/homebound-team/truss/compare/v2.1.0-next.5...v2.1.0-next.6) (2026-03-22)

### Bug Fixes

* Keep source lines. ([7d4ae7d](https://github.com/homebound-team/truss/commit/7d4ae7df0708cb5436ecc51b82255ba3b28766d4))

## [2.1.0-next.5](https://github.com/homebound-team/truss/compare/v2.1.0-next.4...v2.1.0-next.5) (2026-03-22)

### Bug Fixes

* Don't drop earlier values in if/else expressions. ([c1a1418](https://github.com/homebound-team/truss/commit/c1a14180d0fbec14e1a03e9ab28fd62173614301))
* Remove add_ prefix again. ([0ed1dc5](https://github.com/homebound-team/truss/commit/0ed1dc54272ef00004ab2fd3c8798bb5e6a28c00))

## [2.1.0-next.4](https://github.com/homebound-team/truss/compare/v2.1.0-next.3...v2.1.0-next.4) (2026-03-22)

### Bug Fixes

* Use the same variable names for `add`. ([bdae3f9](https://github.com/homebound-team/truss/commit/bdae3f9c4022d73819dfb343cf553dd5424d28b2))

## [2.1.0-next.3](https://github.com/homebound-team/truss/compare/v2.1.0-next.2...v2.1.0-next.3) (2026-03-22)

### Bug Fixes

* Don't inject /truss.css in dev mode. ([1e0321b](https://github.com/homebound-team/truss/commit/1e0321b9f03141c4bca5e928fb9428c29e9b2b3b))

## [2.1.0-next.2](https://github.com/homebound-team/truss/compare/v2.1.0-next.1...v2.1.0-next.2) (2026-03-22)

### Bug Fixes

* Fix error. ([5d36cf5](https://github.com/homebound-team/truss/commit/5d36cf5bffe714c9382421b06beb1248b4e13741))
* Fix variable abbreviations with multiple keys. ([d01171c](https://github.com/homebound-team/truss/commit/d01171c5e55598cdf0f71a9ddd15bc6caf99fde9))
* More fully fix breakpoint negation. ([ec386a5](https://github.com/homebound-team/truss/commit/ec386a59244e8ebde8c2c2e4624cde5e47128108))

## [2.1.0-next.1](https://github.com/homebound-team/truss/compare/v2.0.13...v2.1.0-next.1) (2026-03-22)

### Features

* Phase 1 done. ([14c7b95](https://github.com/homebound-team/truss/commit/14c7b95b52f40e169e625891e7af5783139f7066))

## [2.0.13](https://github.com/homebound-team/truss/compare/v2.0.12...v2.0.13) (2026-03-21)

### Bug Fixes

* Handle css set to ternary that returns undefined. ([#171](https://github.com/homebound-team/truss/issues/171)) ([ad90d40](https://github.com/homebound-team/truss/commit/ad90d4058d2e2b4d569ca1244860878849c4b2b7))

## [2.0.12](https://github.com/homebound-team/truss/compare/v2.0.11...v2.0.12) (2026-03-21)

### Bug Fixes

* Recognize className in a Css.props target. ([#170](https://github.com/homebound-team/truss/issues/170)) ([7cb1b96](https://github.com/homebound-team/truss/commit/7cb1b96bc8ce7d26c9b201c85d8b79350a2135c3))

## [2.0.11](https://github.com/homebound-team/truss/compare/v2.0.10...v2.0.11) (2026-03-21)

### Bug Fixes

* Always rewrite Css.props with object literals. ([#169](https://github.com/homebound-team/truss/issues/169)) ([471b582](https://github.com/homebound-team/truss/commit/471b58255dac71f8f19d386c68eed4602175fa41))

## [2.0.10](https://github.com/homebound-team/truss/compare/v2.0.9...v2.0.10) (2026-03-21)

### Bug Fixes

* Provide Css.props for spreading into attributes. ([#168](https://github.com/homebound-team/truss/issues/168)) ([41c5f97](https://github.com/homebound-team/truss/commit/41c5f97d5988ecd3a3adb1336308802cab40daf4))

## [2.0.9](https://github.com/homebound-team/truss/compare/v2.0.8...v2.0.9) (2026-03-21)

### Bug Fixes

* Add more 'object is not iterable' spread protection. ([#167](https://github.com/homebound-team/truss/issues/167)) ([bd8f27e](https://github.com/homebound-team/truss/commit/bd8f27e094b5a3ac2c219e1489fff15fb3096f1e))

## [2.0.8](https://github.com/homebound-team/truss/compare/v2.0.7...v2.0.8) (2026-03-21)

### Bug Fixes

* Rewrite object literals in ternaries. ([#166](https://github.com/homebound-team/truss/issues/166)) ([bc34800](https://github.com/homebound-team/truss/commit/bc348000b9b692450f1cf7e042eaacd6e96f4aa1))

## [2.0.7](https://github.com/homebound-team/truss/compare/v2.0.6...v2.0.7) (2026-03-21)

### Bug Fixes

* Trust Css.spread even w/o style arrays in it. ([#165](https://github.com/homebound-team/truss/issues/165)) ([dbdbae4](https://github.com/homebound-team/truss/commit/dbdbae4943753175588a691fb99eb7c9efc4fb64))

## [2.0.6](https://github.com/homebound-team/truss/compare/v2.0.5...v2.0.6) (2026-03-21)

### Bug Fixes

* Spread refactoring. ([#164](https://github.com/homebound-team/truss/issues/164)) ([e423c48](https://github.com/homebound-team/truss/commit/e423c484b2bec7489c28461bd839c597c5533c1c))

## [2.0.5](https://github.com/homebound-team/truss/compare/v2.0.4...v2.0.5) (2026-03-21)

### Bug Fixes

* More extensive spread rewriting. ([#163](https://github.com/homebound-team/truss/issues/163)) ([c3af8a6](https://github.com/homebound-team/truss/commit/c3af8a6964a6e814630b627c56282a8b427217da))

## [2.0.4](https://github.com/homebound-team/truss/compare/v2.0.3...v2.0.4) (2026-03-21)

### Bug Fixes

* Another spread pattern. ([#162](https://github.com/homebound-team/truss/issues/162)) ([01aae25](https://github.com/homebound-team/truss/commit/01aae257e60c41686d082cc7454750dabdecc049))

## [2.0.3](https://github.com/homebound-team/truss/compare/v2.0.2...v2.0.3) (2026-03-21)

### Bug Fixes

* Redo bringing back Properties. ([#161](https://github.com/homebound-team/truss/issues/161)) ([6cd133c](https://github.com/homebound-team/truss/commit/6cd133ccca976d75a72fb5f3e59de2651ce8e883))

## [2.0.2](https://github.com/homebound-team/truss/compare/v2.0.1...v2.0.2) (2026-03-21)

### Bug Fixes

* Fix sqPx missing from Css.json. ([#160](https://github.com/homebound-team/truss/issues/160)) ([74d50fe](https://github.com/homebound-team/truss/commit/74d50fec0dcf15bd323c660c1dd2f6a7fa383d47))

## [2.0.1](https://github.com/homebound-team/truss/compare/v2.0.0...v2.0.1) (2026-03-21)

### Bug Fixes

* Add Css.spread for easier migration. ([#159](https://github.com/homebound-team/truss/issues/159)) ([abf37c2](https://github.com/homebound-team/truss/commit/abf37c2491f5d767c4ffd207c540e60416a3f769))

## [2.0.0](https://github.com/homebound-team/truss/compare/v1.137.5...v2.0.0) (2026-03-21)

### ⚠ BREAKING CHANGES

* Trigger 2.0 next release.

### Features

* Add a runtime with helper methods. ([0740620](https://github.com/homebound-team/truss/commit/07406207b72c53b76be76a933158923aac58182f))
* Add Css.typography to replace Css[key] pattern. ([#146](https://github.com/homebound-team/truss/issues/146)) ([67e098b](https://github.com/homebound-team/truss/commit/67e098b8a1ba9bc03d94e03f5edc67f78cebde4c))
* Add file.css.ts support. ([#144](https://github.com/homebound-team/truss/issues/144)) ([d2d135f](https://github.com/homebound-team/truss/commit/d2d135f4725a5a76cbd21cefd22166fd6589aa99))
* Add logging on expressions we don't understand. ([25f3fc4](https://github.com/homebound-team/truss/commit/25f3fc4a03b08f25247aecc9e8f43bfaa9968a2b))
* Add support for consts in css.ts files. ([#149](https://github.com/homebound-team/truss/issues/149)) ([c876fca](https://github.com/homebound-team/truss/commit/c876fcac95d56d3c19fac6659fd7c045ab4a9082))
* Add support for Css.add(cssProp). ([#156](https://github.com/homebound-team/truss/issues/156)) ([f17026d](https://github.com/homebound-team/truss/commit/f17026d3c0d3f0b71ce8798bd3bc1e0f6f68fe1e))
* Debug mode ([#154](https://github.com/homebound-team/truss/issues/154)) ([f83fdba](https://github.com/homebound-team/truss/commit/f83fdbac03cfabccc0bdfb6ebee591ff586055e3))
* StyleX proof-of-concept. ([#132](https://github.com/homebound-team/truss/issues/132)) ([c65e4ee](https://github.com/homebound-team/truss/commit/c65e4ee3f134e58088c0594a25bb9242f4882dfb))
* Trigger 2.0 next release. ([8f69a8b](https://github.com/homebound-team/truss/commit/8f69a8bf85c59e10ce742b1c3d4a9db1fed79844))

### Bug Fixes

* Avoid rewriting non-css prop spreads. ([634c25b](https://github.com/homebound-team/truss/commit/634c25bd4d273f9fb5b96d89915a73ccb64f69da))
* Better handling of css prop rewriting. ([#148](https://github.com/homebound-team/truss/issues/148)) ([7e8546d](https://github.com/homebound-team/truss/commit/7e8546db97ab59a8c1bde58ad5d236e1a515e11c))
* Fix && expressions ([#152](https://github.com/homebound-team/truss/issues/152)) ([c74e51f](https://github.com/homebound-team/truss/commit/c74e51ffa5dd6b2cb40096300687c67b0d021d19))
* Fix another spread scenario ([#150](https://github.com/homebound-team/truss/issues/150)) ([feddee9](https://github.com/homebound-team/truss/commit/feddee951cb1e9b98ecbc503d437970f94e5114e))
* Fix combining className + css rewrite. ([#151](https://github.com/homebound-team/truss/issues/151)) ([8d5bb7c](https://github.com/homebound-team/truss/commit/8d5bb7cd3e2a26a8c466a39e5566a2be6c38c867))
* Fix imports. ([9bf1cca](https://github.com/homebound-team/truss/commit/9bf1cca9bfaa71962d3ce7ad766c14b62df83d12))
* Fix package.json versions. ([70c8726](https://github.com/homebound-team/truss/commit/70c8726caf58add1d6fb493477b28c5b2049d9d8))
* Fix px abbreviations loosing their unit. ([#155](https://github.com/homebound-team/truss/issues/155)) ([bfe0f5d](https://github.com/homebound-team/truss/commit/bfe0f5d40e5edab365a31ebcb5ee0c9d48172ade))
* Fix render functions. ([718e74b](https://github.com/homebound-team/truss/commit/718e74bcf8d10101fbffd95ae2dda6cf1c20bd0d))
* Fix useMemo'd styles not spreading. ([91b5474](https://github.com/homebound-team/truss/commit/91b54742486d452e2bbb9d20ef7b95601a4d415b))
* Handle spreads more safely. ([45d57c4](https://github.com/homebound-team/truss/commit/45d57c469c62d1959b959b9a91f790679e3b59e2))
* More expressions. ([#153](https://github.com/homebound-team/truss/issues/153)) ([0d77bda](https://github.com/homebound-team/truss/commit/0d77bdaa2de2107412cba94a3770c05203a4d4ef))
* Restore Only/increment/px utilities. ([183bf9d](https://github.com/homebound-team/truss/commit/183bf9d21f89296a3300b331131a82597529ed40))
* Rewrite object spreads to array spreads. ([#147](https://github.com/homebound-team/truss/issues/147)) ([07840ae](https://github.com/homebound-team/truss/commit/07840ae7d5e8451ece55d18da7373cd8ff6eeb30))
* Support css={getFromAnotherFile()}. ([38d9d3d](https://github.com/homebound-team/truss/commit/38d9d3de9cd2780585efbb53d130434d69fab882))
* Update snapshots. ([de3fd5c](https://github.com/homebound-team/truss/commit/de3fd5cc322316872405ee6f8e985a667771af05))
* Use tsx for importing truss-config. ([cf01910](https://github.com/homebound-team/truss/commit/cf01910ad7015b7f127102a2d298657cbf432e29))

## [2.0.0-next.15](https://github.com/homebound-team/truss/compare/v2.0.0-next.14...v2.0.0-next.15) (2026-03-21)

### Features

* Add support for Css.add(cssProp). ([#156](https://github.com/homebound-team/truss/issues/156)) ([f17026d](https://github.com/homebound-team/truss/commit/f17026d3c0d3f0b71ce8798bd3bc1e0f6f68fe1e))

## [2.0.0-next.14](https://github.com/homebound-team/truss/compare/v2.0.0-next.13...v2.0.0-next.14) (2026-03-21)

### Features

* Debug mode ([#154](https://github.com/homebound-team/truss/issues/154)) ([f83fdba](https://github.com/homebound-team/truss/commit/f83fdbac03cfabccc0bdfb6ebee591ff586055e3))

## [2.0.0-next.13](https://github.com/homebound-team/truss/compare/v2.0.0-next.12...v2.0.0-next.13) (2026-03-21)

### Bug Fixes

* Fix px abbreviations loosing their unit. ([#155](https://github.com/homebound-team/truss/issues/155)) ([bfe0f5d](https://github.com/homebound-team/truss/commit/bfe0f5d40e5edab365a31ebcb5ee0c9d48172ade))

## [2.0.0-next.12](https://github.com/homebound-team/truss/compare/v2.0.0-next.11...v2.0.0-next.12) (2026-03-20)

### Features

* Add a runtime with helper methods. ([0740620](https://github.com/homebound-team/truss/commit/07406207b72c53b76be76a933158923aac58182f))
* Add logging on expressions we don't understand. ([25f3fc4](https://github.com/homebound-team/truss/commit/25f3fc4a03b08f25247aecc9e8f43bfaa9968a2b))

### Bug Fixes

* Avoid rewriting non-css prop spreads. ([634c25b](https://github.com/homebound-team/truss/commit/634c25bd4d273f9fb5b96d89915a73ccb64f69da))
* Fix imports. ([9bf1cca](https://github.com/homebound-team/truss/commit/9bf1cca9bfaa71962d3ce7ad766c14b62df83d12))
* Fix render functions. ([718e74b](https://github.com/homebound-team/truss/commit/718e74bcf8d10101fbffd95ae2dda6cf1c20bd0d))
* Fix useMemo'd styles not spreading. ([91b5474](https://github.com/homebound-team/truss/commit/91b54742486d452e2bbb9d20ef7b95601a4d415b))
* Handle spreads more safely. ([45d57c4](https://github.com/homebound-team/truss/commit/45d57c469c62d1959b959b9a91f790679e3b59e2))
* Support css={getFromAnotherFile()}. ([38d9d3d](https://github.com/homebound-team/truss/commit/38d9d3de9cd2780585efbb53d130434d69fab882))

## [2.0.0-next.11](https://github.com/homebound-team/truss/compare/v2.0.0-next.10...v2.0.0-next.11) (2026-03-20)

### Bug Fixes

* More expressions. ([#153](https://github.com/homebound-team/truss/issues/153)) ([0d77bda](https://github.com/homebound-team/truss/commit/0d77bdaa2de2107412cba94a3770c05203a4d4ef))

## [2.0.0-next.10](https://github.com/homebound-team/truss/compare/v2.0.0-next.9...v2.0.0-next.10) (2026-03-20)

### Bug Fixes

* Fix && expressions ([#152](https://github.com/homebound-team/truss/issues/152)) ([c74e51f](https://github.com/homebound-team/truss/commit/c74e51ffa5dd6b2cb40096300687c67b0d021d19))

## [2.0.0-next.9](https://github.com/homebound-team/truss/compare/v2.0.0-next.8...v2.0.0-next.9) (2026-03-20)

### Bug Fixes

* Fix combining className + css rewrite. ([#151](https://github.com/homebound-team/truss/issues/151)) ([8d5bb7c](https://github.com/homebound-team/truss/commit/8d5bb7cd3e2a26a8c466a39e5566a2be6c38c867))

## [2.0.0-next.8](https://github.com/homebound-team/truss/compare/v2.0.0-next.7...v2.0.0-next.8) (2026-03-20)

### Bug Fixes

* Fix another spread scenario ([#150](https://github.com/homebound-team/truss/issues/150)) ([feddee9](https://github.com/homebound-team/truss/commit/feddee951cb1e9b98ecbc503d437970f94e5114e))

## [2.0.0-next.7](https://github.com/homebound-team/truss/compare/v2.0.0-next.6...v2.0.0-next.7) (2026-03-20)

### Features

* Add support for consts in css.ts files. ([#149](https://github.com/homebound-team/truss/issues/149)) ([c876fca](https://github.com/homebound-team/truss/commit/c876fcac95d56d3c19fac6659fd7c045ab4a9082))

## [2.0.0-next.6](https://github.com/homebound-team/truss/compare/v2.0.0-next.5...v2.0.0-next.6) (2026-03-20)

### Bug Fixes

* Better handling of css prop rewriting. ([#148](https://github.com/homebound-team/truss/issues/148)) ([7e8546d](https://github.com/homebound-team/truss/commit/7e8546db97ab59a8c1bde58ad5d236e1a515e11c))

## [2.0.0-next.5](https://github.com/homebound-team/truss/compare/v2.0.0-next.4...v2.0.0-next.5) (2026-03-20)

### Bug Fixes

* Rewrite object spreads to array spreads. ([#147](https://github.com/homebound-team/truss/issues/147)) ([07840ae](https://github.com/homebound-team/truss/commit/07840ae7d5e8451ece55d18da7373cd8ff6eeb30))

## [2.0.0-next.4](https://github.com/homebound-team/truss/compare/v2.0.0-next.3...v2.0.0-next.4) (2026-03-20)

### Features

* Add Css.typography to replace Css[key] pattern. ([#146](https://github.com/homebound-team/truss/issues/146)) ([67e098b](https://github.com/homebound-team/truss/commit/67e098b8a1ba9bc03d94e03f5edc67f78cebde4c))

## [2.0.0-next.3](https://github.com/homebound-team/truss/compare/v2.0.0-next.2...v2.0.0-next.3) (2026-03-20)

### Bug Fixes

* Restore Only/increment/px utilities. ([183bf9d](https://github.com/homebound-team/truss/commit/183bf9d21f89296a3300b331131a82597529ed40))
* Update snapshots. ([de3fd5c](https://github.com/homebound-team/truss/commit/de3fd5cc322316872405ee6f8e985a667771af05))

## [2.0.0-next.2](https://github.com/homebound-team/truss/compare/v2.0.0-next.1...v2.0.0-next.2) (2026-03-20)

### Bug Fixes

* Use tsx for importing truss-config. ([cf01910](https://github.com/homebound-team/truss/commit/cf01910ad7015b7f127102a2d298657cbf432e29))

## [2.0.0-next.1](https://github.com/homebound-team/truss/compare/v1.137.5...v2.0.0-next.1) (2026-03-20)

### ⚠ BREAKING CHANGES

* Trigger 2.0 next release.

### Features

* Add file.css.ts support. ([#144](https://github.com/homebound-team/truss/issues/144)) ([d2d135f](https://github.com/homebound-team/truss/commit/d2d135f4725a5a76cbd21cefd22166fd6589aa99))
* StyleX proof-of-concept. ([#132](https://github.com/homebound-team/truss/issues/132)) ([c65e4ee](https://github.com/homebound-team/truss/commit/c65e4ee3f134e58088c0594a25bb9242f4882dfb))
* Trigger 2.0 next release. ([8f69a8b](https://github.com/homebound-team/truss/commit/8f69a8bf85c59e10ce742b1c3d4a9db1fed79844))

## [1.137.5](https://github.com/homebound-team/truss/compare/v1.137.4...v1.137.5) (2025-02-02)


### Bug Fixes

* Fix package.json cssProp export. ([#130](https://github.com/homebound-team/truss/issues/130)) ([7e53ee7](https://github.com/homebound-team/truss/commit/7e53ee7c3f7e853c923880463f3dcff6b077b6e2))

## [1.137.4](https://github.com/homebound-team/truss/compare/v1.137.3...v1.137.4) (2025-01-25)


### Bug Fixes

* Set type=module. ([#129](https://github.com/homebound-team/truss/issues/129)) ([c783f52](https://github.com/homebound-team/truss/commit/c783f52a809cdc1cb84b56373c8eb47272184a34))

## [1.137.3](https://github.com/homebound-team/truss/compare/v1.137.2...v1.137.3) (2025-01-25)


### Bug Fixes

* Fix css types. ([#126](https://github.com/homebound-team/truss/issues/126)) ([27cdf84](https://github.com/homebound-team/truss/commit/27cdf847e8502e7772a108f7d343b3feed2b3d06))
* Use hasOwn const. ([#127](https://github.com/homebound-team/truss/issues/127)) ([e9344ab](https://github.com/homebound-team/truss/commit/e9344ab80b1d63714eecb19fdc9906d77792dc50))

## [1.137.2](https://github.com/homebound-team/truss/compare/v1.137.1...v1.137.2) (2025-01-24)


### Bug Fixes

* Maybe fix key handling. ([#124](https://github.com/homebound-team/truss/issues/124)) ([11525ad](https://github.com/homebound-team/truss/commit/11525adc8fc475b2065354e3d8be5c6e88b964e7))

## [1.137.1](https://github.com/homebound-team/truss/compare/v1.137.0...v1.137.1) (2025-01-24)


### Bug Fixes

* Export the Fragment and jsxs, add fela-dom dependency. ([#123](https://github.com/homebound-team/truss/issues/123)) ([d6ab758](https://github.com/homebound-team/truss/commit/d6ab758d070c8e7f1445147dd72b17d9b4040ed4))

# [1.137.0](https://github.com/homebound-team/truss/compare/v1.136.0...v1.137.0) (2025-01-24)


### Features

* Proof of concept non-component-based css prop. ([#84](https://github.com/homebound-team/truss/issues/84)) ([35f420e](https://github.com/homebound-team/truss/commit/35f420eefc558a5dde29db160e4e95dca9cdee87))

# [1.136.0](https://github.com/homebound-team/truss/compare/v1.135.0...v1.136.0) (2024-06-18)


### Features

* Add fs/fsPx for fontSize. ([#122](https://github.com/homebound-team/truss/issues/122)) ([a4b541e](https://github.com/homebound-team/truss/commit/a4b541e16ff3cc8627c7ee091dfbddc16b7ff4d4))

# [1.135.0](https://github.com/homebound-team/truss/compare/v1.134.0...v1.135.0) (2024-05-31)


### Features

* Double down on abbreviation style. ([#121](https://github.com/homebound-team/truss/issues/121)) ([6b28580](https://github.com/homebound-team/truss/commit/6b28580ee0aae3afb4b443e20650236e33307abd))

# [1.134.0](https://github.com/homebound-team/truss/compare/v1.133.0...v1.134.0) (2024-05-20)


### Features

* support additional properties to utility method ([#120](https://github.com/homebound-team/truss/issues/120)) ([a92172d](https://github.com/homebound-team/truss/commit/a92172d6ea16a2c6be30d855b8e64592e6381a76))

# [1.133.0](https://github.com/homebound-team/truss/compare/v1.132.0...v1.133.0) (2024-03-05)


### Features

* Add order and opacity shorthand styles ([#119](https://github.com/homebound-team/truss/issues/119)) ([c5e5d2c](https://github.com/homebound-team/truss/commit/c5e5d2cf25eb7229feb0e05d1926c33ab4802f90))

# [1.132.0](https://github.com/homebound-team/truss/compare/v1.131.1...v1.132.0) (2023-12-06)


### Features

* Add flex-wrap styles ([#118](https://github.com/homebound-team/truss/issues/118)) ([698070c](https://github.com/homebound-team/truss/commit/698070c3a77a38a7720f4f3604bc2f51978e4fb9))

## [1.131.1](https://github.com/homebound-team/truss/compare/v1.131.0...v1.131.1) (2023-11-08)


### Bug Fixes

* CircleCI yarn cache [sc-42645] ([#117](https://github.com/homebound-team/truss/issues/117)) ([975f68f](https://github.com/homebound-team/truss/commit/975f68fa402de5bc1d2b9fcfac24e101dc74e269))

# [1.131.0](https://github.com/homebound-team/truss/compare/v1.130.0...v1.131.0) (2023-08-16)


### Features

* Add mwfc. ([#114](https://github.com/homebound-team/truss/issues/114)) ([49c90de](https://github.com/homebound-team/truss/commit/49c90de23267e7cf12565727dbd1a2e5015ee4e7))

# [1.130.0](https://github.com/homebound-team/truss/compare/v1.129.0...v1.130.0) (2023-08-11)


### Features

* Add tachyons-rn placeholder. ([#113](https://github.com/homebound-team/truss/issues/113)) ([67cc458](https://github.com/homebound-team/truss/commit/67cc4586da06e06f1e2bb667de02ce3ac7c04b0f))

# [1.129.0](https://github.com/homebound-team/truss/compare/v1.128.1...v1.129.0) (2023-07-18)


### Features

* Add support for container queries ([#111](https://github.com/homebound-team/truss/issues/111)) ([2218354](https://github.com/homebound-team/truss/commit/221835425eedc2b2348d7fea58b20c6e40fe46cd))

## [1.128.1](https://github.com/homebound-team/truss/compare/v1.128.0...v1.128.1) (2023-07-01)


### Bug Fixes

* Export newPxMethod. Fixes [#100](https://github.com/homebound-team/truss/issues/100). ([#108](https://github.com/homebound-team/truss/issues/108)) ([4dc329c](https://github.com/homebound-team/truss/commit/4dc329c1746017ba650a52a659736d5f40091028))

# [1.128.0](https://github.com/homebound-team/truss/compare/v1.127.0...v1.128.0) (2023-07-01)


### Features

* Add placeItems abbreviations. ([#107](https://github.com/homebound-team/truss/issues/107)) ([9ab948b](https://github.com/homebound-team/truss/commit/9ab948b2347618be9c7977de2ce210490336b10a))

# [1.127.0](https://github.com/homebound-team/truss/compare/v1.126.1...v1.127.0) (2023-05-08)


### Features

* Better support for data attributes ([#106](https://github.com/homebound-team/truss/issues/106)) ([bf7c0b2](https://github.com/homebound-team/truss/commit/bf7c0b25575034145a261f897bfcc647135670ce))

## [1.126.1](https://github.com/homebound-team/truss/compare/v1.126.0...v1.126.1) (2023-03-27)


### Bug Fixes

* Actually codegen. ([1704cfa](https://github.com/homebound-team/truss/commit/1704cfa6943f87b0cf687f050a25d1e0d935d0bf))

# [1.126.0](https://github.com/homebound-team/truss/compare/v1.125.0...v1.126.0) (2023-03-27)


### Features

* Add whiteSpace: breakspaces. ([#104](https://github.com/homebound-team/truss/issues/104)) ([793251d](https://github.com/homebound-team/truss/commit/793251dea330763f03268fb580b0116f5c8b8570))

# [1.125.0](https://github.com/homebound-team/truss/compare/v1.124.0...v1.125.0) (2023-03-08)


### Features

* Support grid-auto-columns and grid-auto-rows ([#103](https://github.com/homebound-team/truss/issues/103)) ([1519d4c](https://github.com/homebound-team/truss/commit/1519d4c6152532a6d5dce543da60b5b4f37e49e4))

# [1.124.0](https://github.com/homebound-team/truss/compare/v1.123.0...v1.124.0) (2023-03-04)


### Features

* Add width/height max/min/fit-content abbreviations. ([#102](https://github.com/homebound-team/truss/issues/102)) ([c99a56b](https://github.com/homebound-team/truss/commit/c99a56b494b1ffcc6f5b3476f7926ccb600336a7))

# [1.123.0](https://github.com/homebound-team/truss/compare/v1.122.1...v1.123.0) (2023-03-03)


### Features

* Add place-self. ([#101](https://github.com/homebound-team/truss/issues/101)) ([19081a9](https://github.com/homebound-team/truss/commit/19081a9ae89e3e68dc11ab7a3e27811804f96d6a))

## [1.122.1](https://github.com/homebound-team/truss/compare/v1.122.0...v1.122.1) (2023-01-11)


### Bug Fixes

* Add wa/ha for width/height auto. ([#95](https://github.com/homebound-team/truss/issues/95)) ([dc10094](https://github.com/homebound-team/truss/commit/dc10094543a8904ec60579e772b9157889ec9ed4))

# [1.122.0](https://github.com/homebound-team/truss/compare/v1.121.1...v1.122.0) (2023-01-11)


### Features

* Add 'auto' margin abbreviations. ([#94](https://github.com/homebound-team/truss/issues/94)) ([0a6598b](https://github.com/homebound-team/truss/commit/0a6598b003a7f6b5340cd53514765b588241de4b))

## [1.121.1](https://github.com/homebound-team/truss/compare/v1.121.0...v1.121.1) (2022-11-28)


### Bug Fixes

* Restore WebkitBoxOrient. ([#91](https://github.com/homebound-team/truss/issues/91)) ([5729145](https://github.com/homebound-team/truss/commit/5729145aee6f31b3eb5260edc52930a562df0a37))

# [1.121.0](https://github.com/homebound-team/truss/compare/v1.120.0...v1.121.0) (2022-11-28)


### Features

* Support else w/breakpoints, fix addIn w/conditionals ([#90](https://github.com/homebound-team/truss/issues/90)) ([eecacee](https://github.com/homebound-team/truss/commit/eecacee507ae18eff56fccd3eaf62503207c2703))

# [1.120.0](https://github.com/homebound-team/truss/compare/v1.119.0...v1.120.0) (2022-11-23)


### Features

* Add comments to the utility methods. ([#89](https://github.com/homebound-team/truss/issues/89)) ([d0f6720](https://github.com/homebound-team/truss/commit/d0f67209eb7f759c6b39d72df747513af3b0d265))

# [1.119.0](https://github.com/homebound-team/truss/compare/v1.118.0...v1.119.0) (2022-11-23)


### Features

* Simplify the exported Properties type. ([#88](https://github.com/homebound-team/truss/issues/88)) ([4570ff3](https://github.com/homebound-team/truss/commit/4570ff333635c5380a236343d9bfee0cc55f40ac))

# [1.118.0](https://github.com/homebound-team/truss/compare/v1.117.0...v1.118.0) (2022-11-23)


### Features

* Add sqPx for setting w and h. ([#87](https://github.com/homebound-team/truss/issues/87)) ([74b3f1d](https://github.com/homebound-team/truss/commit/74b3f1dc459c2e3b7a0e43f42758779256d139e8))

# [1.117.0](https://github.com/homebound-team/truss/compare/v1.116.0...v1.117.0) (2022-11-23)


### Features

* Add onHover. ([#86](https://github.com/homebound-team/truss/issues/86)) ([fc8e73a](https://github.com/homebound-team/truss/commit/fc8e73a88a048999e0303de7a491775e6945b9e6))

# [1.116.0](https://github.com/homebound-team/truss/compare/v1.115.0...v1.116.0) (2022-11-23)


### Features

* Add if<breakpoint> methods. ([#85](https://github.com/homebound-team/truss/issues/85)) ([591cc3e](https://github.com/homebound-team/truss/commit/591cc3e524018310a235d9d33d9a23892edfb802))

# [1.115.0](https://github.com/homebound-team/truss/compare/v1.114.0...v1.115.0) (2022-10-29)


### Features

* Add breakpoint types and enum ([#79](https://github.com/homebound-team/truss/issues/79)) ([d4cd82f](https://github.com/homebound-team/truss/commit/d4cd82ff78f65c5d115cf8cf1edd27cef8a9aff3))

# [1.114.0](https://github.com/homebound-team/truss/compare/v1.113.1...v1.114.0) (2022-06-25)


### Features

* Support custom configuration path ([#76](https://github.com/homebound-team/truss/issues/76)) ([4a7a386](https://github.com/homebound-team/truss/commit/4a7a3867e788817e7f5c2acac761e6fa090c46bd))

## [1.113.1](https://github.com/homebound-team/truss/compare/v1.113.0...v1.113.1) (2022-06-22)


### Bug Fixes

* Update README and package.json to be compatible with npmjs ([#75](https://github.com/homebound-team/truss/issues/75)) ([d523bb0](https://github.com/homebound-team/truss/commit/d523bb0ed09049978caa65dab5d69452a1849270))

# [1.113.0](https://github.com/homebound-team/truss/compare/v1.112.1...v1.113.0) (2022-05-16)


### Features

* Support 'justify-items' ([#74](https://github.com/homebound-team/truss/issues/74)) ([ad4e602](https://github.com/homebound-team/truss/commit/ad4e602b5230ba6efaf7c03a6089fa4fb01c9f4e))

## [1.112.1](https://github.com/homebound-team/truss/compare/v1.112.0...v1.112.1) (2022-04-04)


### Bug Fixes

* Pass module: commonjs to ts-node. ([cec97db](https://github.com/homebound-team/truss/commit/cec97db76268edc66050a48392bd99665d40b55e))

# [1.112.0](https://github.com/homebound-team/truss/compare/v1.111.3...v1.112.0) (2022-04-04)


### Features

* Add a template to copy/paste from. ([39cc9dc](https://github.com/homebound-team/truss/commit/39cc9dcfd47dcdfdd22fa419fecfd1ef53d021f8))

## [1.111.3](https://github.com/homebound-team/truss/compare/v1.111.2...v1.111.3) (2022-04-04)


### Bug Fixes

* Use a cli.js for the shebang. ([6a29ed6](https://github.com/homebound-team/truss/commit/6a29ed61d4f0b0903e863b3dedb87ae80d3a90c6))

## [1.111.2](https://github.com/homebound-team/truss/compare/v1.111.1...v1.111.2) (2022-04-04)


### Bug Fixes

* Poke release to fix npm error. ([29b6fdd](https://github.com/homebound-team/truss/commit/29b6fdda0746766aefdd124aaba67fa2558b662e))

## [1.111.1](https://github.com/homebound-team/truss/compare/v1.111.0...v1.111.1) (2022-04-04)


### Bug Fixes

* Fix publishing to the org should still be public. ([92b2ab3](https://github.com/homebound-team/truss/commit/92b2ab32fe7496822a45848710257adfef883bc9))

# [1.111.0](https://github.com/homebound-team/truss/compare/v1.110.3...v1.111.0) (2022-04-04)


### Features

* Move to data-based config. ([#73](https://github.com/homebound-team/truss/issues/73)) ([16f7e1a](https://github.com/homebound-team/truss/commit/16f7e1a25530e4af1b681c8b65a78e6c5d61c274)), closes [#64](https://github.com/homebound-team/truss/issues/64)

## [1.110.3](https://github.com/homebound-team/truss/compare/v1.110.2...v1.110.3) (2022-04-04)


### Bug Fixes

* Mark truss as not private. ([7e68b6f](https://github.com/homebound-team/truss/commit/7e68b6f91f57f09bb42723d52c3c5a6ddb2d4bb7))

## [1.110.2](https://github.com/homebound-team/truss/compare/v1.110.1...v1.110.2) (2022-04-04)


### Bug Fixes

* Try release again. ([5d5d303](https://github.com/homebound-team/truss/commit/5d5d30331f36dd751fb3ee5c62eef64de64652dd))

## [1.110.1](https://github.com/homebound-team/truss/compare/v1.110.0...v1.110.1) (2022-04-04)


### Bug Fixes

* Move to yarn workspaces. ([#72](https://github.com/homebound-team/truss/issues/72)) ([0da352a](https://github.com/homebound-team/truss/commit/0da352a42a8b2a3a1e0862f6cad4e13b6c8a7b7a))

# [1.110.0](https://github.com/homebound-team/truss/compare/v1.109.0...v1.110.0) (2022-04-03)


### Features

* Move to semantic release. ([#68](https://github.com/homebound-team/truss/issues/68)) ([2e28aa1](https://github.com/homebound-team/truss/commit/2e28aa1cc4b5ca22c5d9b6daec78c6be0c6bc3c8))
