import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/dashboard.tsx"),
  route("projects", "routes/projects.tsx"),
  route("settings", "routes/settings.tsx"),
  route("pricing", "routes/pricing.tsx"),
  route("docs", "routes/docs.tsx"),
  route("lab", "routes/lab.tsx"),
] satisfies RouteConfig;
