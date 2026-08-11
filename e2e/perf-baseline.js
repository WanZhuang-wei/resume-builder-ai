const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const BASE = "http://localhost:5173";
const REPORT_PATH = "D:/workspace/project002_简历生成助手/test-results/perf-baseline.json";
const SCREENSHOT_DIR = "D:/workspace/project002_简历生成助手/test-results/perf-screenshots";

async function waitForServer(url, timeoutMs) {
  timeoutMs = timeoutMs || 30000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Server start timeout");
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  console.log("Starting Vite dev server...");
  const server = spawn("npx", ["vite", "--port", "5173", "--host"], {
    cwd: "D:/workspace/project002_简历生成助手",
    stdio: ["pipe", "pipe", "pipe"], shell: true,
  });
  try {
    await waitForServer(BASE);
    console.log("Server ready at " + BASE);
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    const results = [];
    const routes = [
      { route: "#/dashboard", name: "Dashboard" },
      { route: "#/profile", name: "Profile" },
      { route: "#/resume", name: "Resume" },
      { route: "#/settings", name: "Settings" },
    ];
    for (const r of routes) {
      console.log("  Measuring " + r.name + "...");
      await page.goto(BASE + "/" + r.route, { waitUntil: "networkidle", timeout: 15000 });
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const paint = performance.getEntriesByType("paint");
        return {
          loadTime: nav ? nav.loadEventEnd : null,
          fcp: (paint.find(p => p.name === "first-contentful-paint") || {}).startTime || null,
          domReady: nav ? nav.domContentLoadedEventEnd : null,
        };
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, r.name + ".png"), fullPage: true });
      results.push({ page: r.name, route: r.route, ...m, ts: new Date().toISOString() });
      console.log("    FCP: " + (m.fcp ? m.fcp.toFixed(0) + "ms" : "N/A") + "  Load: " + (m.loadTime ? m.loadTime.toFixed(0) + "ms" : "N/A"));
    }
    await browser.close();
    const report = { ts: new Date().toISOString(), env: "Chromium 375x812", pages: results };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log("\nReport: " + REPORT_PATH);
  } finally { server.kill(); }
}
run().catch(e => { console.error(e.message); process.exit(1); });
