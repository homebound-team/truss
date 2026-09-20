// Shared demo data. This file is byte-identical across every app in the arena,
// so the only difference between them is how styling is authored.

export type Status = "live" | "staging" | "paused" | "archived";

export const kpis = [
  { label: "Monthly recurring revenue", value: "$418,204", delta: 12.4, up: true, series: [12, 18, 15, 24, 22, 31, 28, 36, 34, 42, 46, 52] },
  { label: "Active workspaces", value: "9,318", delta: 4.1, up: true, series: [30, 28, 33, 31, 36, 34, 39, 41, 38, 44, 43, 48] },
  { label: "Churn rate", value: "1.82%", delta: 0.6, up: false, series: [22, 24, 21, 25, 23, 20, 22, 19, 21, 18, 17, 16] },
  { label: "p95 API latency", value: "142 ms", delta: 8.3, up: false, series: [40, 38, 42, 36, 34, 37, 30, 32, 28, 26, 27, 22] },
];

export const revenueBars = [
  { month: "Jan", primary: 42, secondary: 18 },
  { month: "Feb", primary: 51, secondary: 22 },
  { month: "Mar", primary: 47, secondary: 25 },
  { month: "Apr", primary: 63, secondary: 29 },
  { month: "May", primary: 58, secondary: 34 },
  { month: "Jun", primary: 72, secondary: 31 },
  { month: "Jul", primary: 69, secondary: 38 },
  { month: "Aug", primary: 84, secondary: 42 },
  { month: "Sep", primary: 79, secondary: 47 },
  { month: "Oct", primary: 92, secondary: 44 },
  { month: "Nov", primary: 88, secondary: 51 },
  { month: "Dec", primary: 97, secondary: 56 },
];

export const activity = [
  { who: "Amara Osei", initials: "AO", what: "promoted", target: "checkout-v3", when: "2m ago", tone: "accent" as const },
  { who: "Dev Patel", initials: "DP", what: "opened an incident on", target: "edge-router", when: "18m ago", tone: "danger" as const },
  { who: "Lena Fischer", initials: "LF", what: "merged 4 commits into", target: "billing-core", when: "1h ago", tone: "success" as const },
  { who: "Tomás Rivera", initials: "TR", what: "archived", target: "legacy-webhooks", when: "3h ago", tone: "muted" as const },
  { who: "Yuki Tanaka", initials: "YT", what: "invited 3 members to", target: "Platform", when: "5h ago", tone: "accent" as const },
  { who: "Noor Haddad", initials: "NH", what: "rotated credentials for", target: "prod-eu-west", when: "8h ago", tone: "warning" as const },
];

export const insights = [
  { icon: "◈", title: "Cache hit ratio improved", body: "Edge cache efficiency rose to 94.2% after the Fastly config change on Oct 14.", tag: "Performance" },
  { icon: "◆", title: "3 workspaces near quota", body: "Northwind, Vertex and Lumen are within 8% of their seat limits this cycle.", tag: "Billing" },
  { icon: "▲", title: "Failed webhooks trending up", body: "Retries to customer endpoints up 22% week over week, concentrated in ap-south-1.", tag: "Reliability" },
];

export const projects: Array<{
  name: string;
  repo: string;
  owner: string;
  initials: string;
  status: Status;
  progress: number;
  budget: string;
  updated: string;
}> = [
  { name: "Checkout v3", repo: "nimbus/checkout", owner: "Amara Osei", initials: "AO", status: "live", progress: 92, budget: "$184,000", updated: "Oct 22" },
  { name: "Edge Router", repo: "nimbus/edge-router", owner: "Dev Patel", initials: "DP", status: "staging", progress: 64, budget: "$96,500", updated: "Oct 21" },
  { name: "Billing Core", repo: "nimbus/billing-core", owner: "Lena Fischer", initials: "LF", status: "live", progress: 78, budget: "$212,300", updated: "Oct 21" },
  { name: "Identity Broker", repo: "nimbus/identity", owner: "Yuki Tanaka", initials: "YT", status: "paused", progress: 31, budget: "$58,900", updated: "Oct 18" },
  { name: "Insights Pipeline", repo: "nimbus/insights", owner: "Noor Haddad", initials: "NH", status: "staging", progress: 47, budget: "$131,750", updated: "Oct 17" },
  { name: "Legacy Webhooks", repo: "nimbus/webhooks", owner: "Tomás Rivera", initials: "TR", status: "archived", progress: 100, budget: "$12,400", updated: "Oct 09" },
  { name: "Mobile SDK", repo: "nimbus/mobile-sdk", owner: "Amara Osei", initials: "AO", status: "live", progress: 85, budget: "$77,200", updated: "Oct 22" },
  { name: "Audit Log Store", repo: "nimbus/audit", owner: "Dev Patel", initials: "DP", status: "staging", progress: 22, budget: "$44,000", updated: "Oct 16" },
];

export const statusLabels: Record<Status, string> = {
  live: "Live",
  staging: "Staging",
  paused: "Paused",
  archived: "Archived",
};

export const plans = [
  {
    name: "Starter",
    price: { monthly: 0, yearly: 0 },
    blurb: "For side projects and evaluation.",
    featured: false,
    cta: "Start free",
    features: ["3 workspaces", "1 GB artifact storage", "Community support", "7-day log retention", "Basic analytics"],
  },
  {
    name: "Team",
    price: { monthly: 49, yearly: 39 },
    blurb: "For product teams shipping weekly.",
    featured: true,
    cta: "Start 14-day trial",
    features: ["Unlimited workspaces", "250 GB artifact storage", "Priority support, 4h SLA", "90-day log retention", "Advanced analytics + exports", "SSO via Google & Okta", "Audit log streaming"],
  },
  {
    name: "Enterprise",
    price: { monthly: null, yearly: null },
    blurb: "For regulated, multi-region orgs.",
    featured: false,
    cta: "Talk to sales",
    features: ["Everything in Team", "Dedicated infrastructure", "24/7 support, 1h SLA", "Unlimited retention", "SCIM provisioning", "BAA & DPA available"],
  },
];

export const comparison = [
  { feature: "Workspaces", starter: "3", team: "Unlimited", enterprise: "Unlimited" },
  { feature: "Artifact storage", starter: "1 GB", team: "250 GB", enterprise: "Custom" },
  { feature: "Log retention", starter: "7 days", team: "90 days", enterprise: "Unlimited" },
  { feature: "SSO / SAML", starter: "—", team: "Google, Okta", enterprise: "Any IdP" },
  { feature: "SCIM provisioning", starter: "—", team: "—", enterprise: "Included" },
  { feature: "Support SLA", starter: "Community", team: "4 hours", enterprise: "1 hour" },
  { feature: "Deployment regions", starter: "1", team: "3", enterprise: "Unlimited" },
  { feature: "Audit log streaming", starter: "—", team: "Included", enterprise: "Included" },
];

export const faqs = [
  { q: "Can I change plans mid-cycle?", a: "Yes. Upgrades take effect immediately and we prorate the difference against your next invoice. Downgrades apply at the start of the following billing period." },
  { q: "What counts as a workspace?", a: "A workspace is an isolated environment with its own members, secrets and deploy targets. Preview environments spawned from pull requests do not count toward your limit." },
  { q: "Do you offer annual invoicing?", a: "Team and Enterprise plans can be invoiced annually with net-30 terms. Contact sales to switch from card billing to invoicing." },
  { q: "Is there a non-profit discount?", a: "Registered non-profits and accredited educational institutions get 50% off the Team plan. Send us proof of status and we will apply it to your account." },
];

export const docsNav = [
  {
    section: "Getting started",
    items: [
      { label: "Introduction", active: false },
      { label: "Installation", active: false },
      { label: "Your first deploy", active: true },
      { label: "CLI reference", active: false },
    ],
  },
  {
    section: "Core concepts",
    items: [
      { label: "Workspaces", active: false },
      { label: "Build pipeline", active: false },
      { label: "Edge routing", active: false },
      { label: "Secrets", active: false },
    ],
  },
  {
    section: "Operations",
    items: [
      { label: "Observability", active: false },
      { label: "Incident response", active: false },
      { label: "Cost controls", active: false },
    ],
  },
];

export const toc = [
  { label: "Before you begin", depth: 0 },
  { label: "Authenticate the CLI", depth: 0 },
  { label: "Link a repository", depth: 0 },
  { label: "Choosing a region", depth: 1 },
  { label: "Configure the build", depth: 0 },
  { label: "Promote to production", depth: 0 },
];

export const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/settings", label: "Settings" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Docs" },
  { to: "/lab", label: "Lab" },
];

export const footerColumns = [
  { title: "Product", links: ["Changelog", "Roadmap", "Status", "Integrations"] },
  { title: "Developers", links: ["Documentation", "API reference", "CLI", "SDKs"] },
  { title: "Company", links: ["About", "Careers", "Blog", "Press kit"] },
  { title: "Legal", links: ["Privacy", "Terms", "DPA", "Sub-processors"] },
];

export const runLog = [
  { id: "run-4821", job: "api-gateway", step: "build", state: "passed", duration: "1m 42s", queue: 3 },
  { id: "run-4820", job: "web-console", step: "test", state: "failed", duration: "3m 08s", queue: 1 },
  { id: "run-4819", job: "billing-worker", step: "deploy", state: "running", duration: "0m 51s", queue: 0 },
  { id: "run-4818", job: "search-index", step: "build", state: "passed", duration: "2m 14s", queue: 2 },
  { id: "run-4817", job: "auth-service", step: "test", state: "failed", duration: "0m 33s", queue: 5 },
  { id: "run-4816", job: "cdn-purge", step: "deploy", state: "queued", duration: "—", queue: 8 },
  { id: "run-4815", job: "metrics-rollup", step: "build", state: "passed", duration: "4m 02s", queue: 1 },
  { id: "run-4814", job: "edge-router", step: "test", state: "passed", duration: "1m 19s", queue: 0 },
];

export const runStateLabels: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  running: "Running",
  queued: "Queued",
};

export const regions = [
  { name: "us-east-1a", cpu: 72, mem: 61, pods: 148, cap: 200 },
  { name: "us-west-2b", cpu: 38, mem: 44, pods: 92, cap: 200 },
  { name: "eu-central-1", cpu: 91, mem: 83, pods: 187, cap: 200 },
  { name: "ap-south-1", cpu: 24, mem: 30, pods: 51, cap: 200 },
];

export const pipelineTracks = [
  { label: "Ingest", pct: 82 },
  { label: "Transform", pct: 47 },
  { label: "Publish", pct: 15 },
];
