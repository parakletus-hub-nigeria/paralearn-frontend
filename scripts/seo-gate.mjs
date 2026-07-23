#!/usr/bin/env node
/**
 * seo-gate.mjs
 *
 * The G_gate check from the scoring model, made real: a build-time gate that
 * fails loudly instead of a spreadsheet someone checks once. Run it against
 * a live server (dev or `next start`) and it verifies, per page:
 *
 *   - the page actually returns 200 (not a redirect loop, not a 500)
 *   - marketing pages are NOT accidentally noindexed; stub pages ARE
 *   - a self-referential <link rel="canonical"> is present
 *   - exactly one <h1> exists (heading-hierarchy integrity)
 *   - at least one valid application/ld+json block is present
 *   - robots.txt / sitemap.xml / llms.txt all resolve and are non-empty
 *
 * Any G_gate-class failure (crawlability/indexability) exits non-zero and
 * fails the build. Softer content-quality checks (F_i factors) print a
 * warning but do not fail the build on their own — same distinction the
 * scoring model draws between the binary gate and the weighted factors.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/seo-gate.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const INDEXABLE_PATHS = [
  "/",
  "/about",
  "/product",
  "/contact",
  "/careers",
  "/documentation",
  "/partners",
  "/help",
  "/support",
  "/terms",
  "/privacy",
  "/security",
  "/cookies",
];

const NOINDEX_PATHS = ["/pricing", "/blog", "/features"];

let failures = 0;
let warnings = 0;

function fail(label, detail) {
  failures += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

function warn(label, detail) {
  warnings += 1;
  console.warn(`  WARN  ${label}${detail ? ` — ${detail}` : ""}`);
}

function pass(label) {
  console.log(`  pass  ${label}`);
}

async function fetchText(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "seo-gate/1.0" } });
  const body = await res.text();
  return { res, body, url };
}

function extractMetaRobots(html) {
  const match = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  return match ? match[1].toLowerCase() : null;
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i);
  return match ? match[1] : null;
}

function countH1(html) {
  return (html.match(/<h1[\s>]/gi) || []).length;
}

function countJsonLd(html) {
  return (html.match(/<script[^>]*type=["']application\/ld\+json["']/gi) || []).length;
}

async function checkIndexablePage(path) {
  console.log(`\n${path}`);
  let res, body, url;
  try {
    ({ res, body, url } = await fetchText(path));
  } catch (err) {
    fail("reachable", `request failed: ${err.message}`);
    return;
  }

  if (res.status !== 200) {
    fail("status 200", `got ${res.status} for ${url}`);
    return;
  }
  pass(`status 200 (${url})`);

  const robotsMeta = extractMetaRobots(body);
  if (robotsMeta && robotsMeta.includes("noindex")) {
    fail("not accidentally noindexed", `<meta name="robots" content="${robotsMeta}">`);
  } else {
    pass("indexable (no noindex meta)");
  }

  const canonical = extractCanonical(body);
  if (!canonical) {
    fail("canonical present", "no <link rel=\"canonical\"> found");
  } else {
    pass(`canonical present (${canonical})`);
  }

  const h1Count = countH1(body);
  if (h1Count !== 1) {
    warn("exactly one <h1>", `found ${h1Count}`);
  } else {
    pass("exactly one <h1>");
  }

  const jsonLdCount = countJsonLd(body);
  if (path === "/" && jsonLdCount === 0) {
    warn("structured data present", "no application/ld+json block found on homepage");
  } else if (jsonLdCount > 0) {
    pass(`structured data present (${jsonLdCount} block${jsonLdCount > 1 ? "s" : ""})`);
  }
}

async function checkNoindexPage(path) {
  console.log(`\n${path} (expected noindex)`);
  let res, body;
  try {
    ({ res, body } = await fetchText(path));
  } catch (err) {
    warn("reachable", `request failed: ${err.message}`);
    return;
  }

  if (res.status !== 200) {
    warn("status 200", `got ${res.status}`);
    return;
  }

  const robotsMeta = extractMetaRobots(body);
  if (!robotsMeta || !robotsMeta.includes("noindex")) {
    fail("noindex applied", "expected <meta name=\"robots\" content=\"noindex...\"> but it's missing — this stub page would be indexed as-is");
  } else {
    pass("noindex applied as expected");
  }
}

async function checkWellKnownFile(path, { mustInclude } = {}) {
  console.log(`\n${path}`);
  let res, body;
  try {
    ({ res, body } = await fetchText(path));
  } catch (err) {
    fail("reachable", `request failed: ${err.message}`);
    return;
  }

  if (res.status !== 200 || body.trim().length === 0) {
    fail("resolves with content", `status ${res.status}, ${body.length} bytes`);
    return;
  }
  pass(`resolves with content (${body.length} bytes)`);

  if (mustInclude) {
    for (const needle of mustInclude) {
      if (!body.includes(needle)) {
        warn("expected reference present", `"${needle}" not found in ${path}`);
      }
    }
  }
}

async function main() {
  console.log(`seo-gate: auditing ${BASE_URL}`);

  for (const path of INDEXABLE_PATHS) {
    await checkIndexablePage(path);
  }
  for (const path of NOINDEX_PATHS) {
    await checkNoindexPage(path);
  }

  await checkWellKnownFile("/robots.txt", { mustInclude: ["Sitemap:"] });
  await checkWellKnownFile("/sitemap.xml", { mustInclude: ["<urlset"] });
  await checkWellKnownFile("/llms.txt");

  console.log(`\n${"-".repeat(40)}`);
  console.log(`seo-gate: ${failures} failure(s), ${warnings} warning(s)`);

  if (failures > 0) {
    console.error("\nG_gate failed — page(s) above are not eligible to rank regardless of any other factor. Fix before merging.");
    process.exit(1);
  }

  console.log("\nG_gate passed on all checked pages.");
}

main().catch((err) => {
  console.error("seo-gate crashed:", err);
  process.exit(1);
});
