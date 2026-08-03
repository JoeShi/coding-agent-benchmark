import type { NextConfig } from "next";

/**
 * The Task Monitor page (`/monitor`) reads live fleet state from `app/server.py`,
 * which shells out to the `aws` CLI and caches trial records on disk — it cannot
 * move into Next. Rewriting `/api/*` onto it keeps a single origin for the
 * browser, so the dashboard fetches relative URLs and no CORS headers are needed.
 */
const MONITOR_API = process.env.MONITOR_API ?? "http://127.0.0.1:8081";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${MONITOR_API}/api/:path*` }];
  },
};

export default nextConfig;
