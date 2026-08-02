// Downloads the target site's fonts + favicon into public/.
// Source: https://artificialanalysis.ai (see docs/research/FOUNDATION.md)
// NOTE: suisseIntl / victorSerifBasic are commercial licensed typefaces. Local /
// internal clone use only — do not redistribute.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const BASE = "https://artificialanalysis.ai";
const OUT = new URL("../public/", import.meta.url).pathname;

const ASSETS = [
  ["/_next/static/media/5fc57f0bdf4f18a4-s.p.woff2", "fonts/suisse-intl-300.woff2"],
  ["/_next/static/media/33b0a75b30dd1c81-s.p.woff2", "fonts/suisse-intl-400.woff2"],
  ["/_next/static/media/09d69b6d2cb2dadb-s.p.woff2", "fonts/suisse-intl-500.woff2"],
  ["/_next/static/media/2894d3242f139187-s.p.woff2", "fonts/victor-serif-500.woff2"],
  ["/_next/static/media/7ed4844278386875-s.p.woff2", "fonts/victor-serif-600.woff2"],
  ["/favicon.ico", "seo/favicon.ico"],
];

const BATCH = 4;

async function fetchOne([path, dest]) {
  const url = BASE + path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const target = join(OUT, dest);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buf);
  return `${dest} (${buf.length} bytes)`;
}

for (let i = 0; i < ASSETS.length; i += BATCH) {
  const results = await Promise.allSettled(ASSETS.slice(i, i + BATCH).map(fetchOne));
  for (const r of results) {
    if (r.status === "fulfilled") console.log("ok  ", r.value);
    else console.error("FAIL", r.reason.message);
  }
}
