import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

/* ---------------- tiny static server for ./dist (SPA fallback) ---------------- */
const DIST = new URL("../dist", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.startsWith("/api/")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    if (p === "/") p = "/index.html";
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST)) throw new Error("nope");
    let body;
    try {
      body = await readFile(file);
    } catch {
      file = join(DIST, "index.html");
      body = await readFile(file);
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch (e) {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(4187, "127.0.0.1", r));

/* ---------------- test harness ---------------- */
let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
};
const EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "fa-IR" })).newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

const dir = () => page.evaluate(() => document.documentElement.dir);
const BASE = "http://127.0.0.1:4187";

try {
  /* 1) auth loads, RTL default */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  ok("app boots → auth screen", await page.getByText("خوش برگشتی").first().isVisible().catch(() => false));
  ok("default locale is fa + dir=rtl", (await dir()) === "rtl");
  ok("tab title is Life OS", (await page.title()).includes("Life OS"));

  /* auth tabs = image-style equal halves */
  const tabLogin = await page.getByRole("button", { name: "ورود", exact: true }).first().boundingBox();
  const tabSignup = await page.getByRole("button", { name: "ثبت‌نام", exact: true }).first().boundingBox();
  ok(
    "auth tab bar: login/signup equal-width halves",
    !!tabLogin && !!tabSignup && Math.abs(tabLogin.width - tabSignup.width) < 2 && tabLogin.width > 120,
    tabLogin && tabSignup ? `${Math.round(tabLogin.width)}px vs ${Math.round(tabSignup.width)}px` : "missing",
  );

  /* 2) sign up (Google button = demo identity in local mode) */
  await page.getByRole("button", { name: /ادامه با گوگل/ }).click();
  await page.waitForTimeout(1200);
  ok("sign-in → dashboard loads", await page.getByText(/صبح بخیر|ظهر بخیر|عصر بخیر/).first().isVisible().catch(() => false));

  /* 3) NO seed data */
  const bodyFa = await page.textContent("body");
  ok("no seeded goals/tasks/habits", !bodyFa.includes("ورزش صبحگاهی") && !bodyFa.includes("تسلط بر زبان انگلیسی") && !bodyFa.includes("Master English"));

  /* 4) create a goal */
  await page.getByRole("link", { name: "اهداف" }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "هدف جدید" }).first().click();
  await page.waitForTimeout(500);
  const goalModal = page.locator("div.glass-strong").last();
  await goalModal.locator("input").first().fill("خواندن ۱۲ کتاب امسال");
  await goalModal.getByRole("button", { name: "ذخیره" }).click();
  await page.waitForTimeout(500);
  ok("goal created and visible", await page.getByText("خواندن ۱۲ کتاب امسال").first().isVisible().catch(() => false));

  /* 5) create a task */
  await page.getByRole("link", { name: "وظایف" }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "وظیفه جدید" }).first().click();
  await page.waitForTimeout(500);
  const taskModal = page.locator("div.glass-strong").last();
  await taskModal.locator("input").first().fill("نوشتن گزارش هفتگی");
  await taskModal.getByRole("button", { name: "ذخیره" }).click();
  await page.waitForTimeout(500);
  ok("task created and visible in list", await page.getByText("نوشتن گزارش هفتگی").first().isVisible().catch(() => false));

  /* 6) kanban board drag targets exist */
  await page.getByRole("button", { name: /برد/ }).click();
  await page.waitForTimeout(400);
  ok("kanban renders 3 columns", (await page.getByText("در حال انجام").count()) >= 1 && (await page.getByText("انجام‌شده").count()) >= 1);

  /* 7) create a habit and check it off */
  await page.getByRole("link", { name: "عادت‌ها" }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "عادت جدید" }).first().click();
  await page.waitForTimeout(500);
  const habitModal = page.locator("div.glass-strong").last();
  await habitModal.locator("input").first().fill("پیاده‌روی");
  await habitModal.getByRole("button", { name: "ذخیره" }).click();
  await page.waitForTimeout(500);
  ok("habit created", await page.getByText("پیاده‌روی").first().isVisible().catch(() => false));
  await page.getByRole("button", { name: "ثبت امروز" }).click();
  await page.waitForTimeout(600);
  const checkedState = await page.getByRole("button", { name: /امروز ثبت شد/ }).isVisible().catch(() => false);
  const heatCell = await page.locator("[title]").count();
  ok("habit checked off (button flips state)", checkedState);
  ok("heatmap rendered with day cells", heatCell > 100, `${heatCell} cells with tooltips`);

  /* 8) AI Coach answers with LIVE context of the items just created */
  await page.keyboard.press("Control+KeyJ");
  await page.waitForTimeout(700);
  ok("coach opens via ⌘J", await page.getByText("مربی هوشمند").first().isVisible().catch(() => false));
  await page.getByRole("button", { name: "برنامه امروز" }).click();
  const panel = page.locator("aside");
  const ctxHit = await panel.getByText("نوشتن گزارش هفتگی").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  ok("coach reply references the just-created task (live context)", ctxHit);
  const modeBadge = await panel.getByText(/موتور محلی|متصل به Claude/).first().isVisible().catch(() => false);
  ok("coach mode badge visible (engine honesty)", modeBadge);

  /* 9) English → LTR (pill shows current lang code, like the reference) */
  await page.getByRole("button", { name: "language" }).first().click();
  await page.waitForTimeout(700);
  ok("switch to English → dir=ltr", (await dir()) === "ltr");
  const sidebarEn = await page.locator("aside").first().boundingBox();
  ok("LTR puts sidebar on the LEFT", !!sidebarEn && sidebarEn.x < 300, `x=${sidebarEn?.x}`);
  await page.screenshot({ path: "e2e/en-ltr.png" });

  /* 10) Persian → RTL */
  await page.getByRole("button", { name: "language" }).first().click();
  await page.waitForTimeout(700);
  ok("switch to Persian → dir=rtl", (await dir()) === "rtl");
  const sidebarFa = await page.locator("aside").first().boundingBox();
  ok("RTL mirrors sidebar to the RIGHT", !!sidebarFa && sidebarFa.x > 900, `x=${sidebarFa?.x}`);
  await page.screenshot({ path: "e2e/fa-rtl.png" });

  /* 10b) theme pills (روشن/تیره) */
  await page.getByRole("button", { name: "روشن", exact: true }).click();
  await page.waitForTimeout(400);
  const light = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
  ok("روشن pill switches to light mode", light);
  await page.getByRole("button", { name: "تیره", exact: true }).click();
  await page.waitForTimeout(400);
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  ok("تیره pill switches to dark mode", dark);

  /* 11) data persists across reload */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const after = await page.textContent("body");
  ok("data survives reload (habit kept)", after.includes("پیاده‌روی"));

  /* 12) admin gate \u2192 claim admin (local mode) \u2192 dashboard */
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  ok("non-admin hits the access gate at /admin", await page.getByText("\u062f\u0633\u062a\u0631\u0633\u06cc \u0646\u062f\u0627\u0631\u06cc").first().isVisible().catch(() => false));
  await page.getByRole("button", { name: "\u0627\u06cc\u0646 \u062d\u0633\u0627\u0628 \u0631\u0627 \u0627\u062f\u0645\u06cc\u0646 \u06a9\u0646" }).click();
  await page.waitForTimeout(900);
  ok("after claiming admin, dashboard renders", await page.getByText("\u0641\u0647\u0631\u0633\u062a \u06a9\u0627\u0631\u0628\u0631\u0627\u0646").first().isVisible().catch(() => false));
  ok("users table shows the current account", await page.getByText("demo.google@lifeos.app").first().isVisible().catch(() => false));

  /* 13) deliberately broken API call \u2192 Issues log */
  await page.evaluate(() =>
    fetch("/api/admin/errors", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null),
  );
  await page.waitForTimeout(6800); // let the 5s auto-refresh pick it up
  ok(
    "broken /api call logged & shown in issues",
    await page.getByText(/\/api\/admin\/errors/).first().isVisible().catch(() => false),
  );

  /* 14) second signup appears in the admin users list */
  await page.getByRole("button", { name: /\u062e\u0631\u0648\u062c/ }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "\u062b\u0628\u062a\u200c\u0646\u0627\u0645", exact: true }).first().click();
  await page.waitForTimeout(400);
  const f1 = page.locator("form");
  await f1.getByPlaceholder("\u0645\u062b\u0644\u0627\u064b \u0633\u0627\u0631\u0627").fill("\u062a\u0633\u062a \u062f\u0648\u0645");
  await f1.getByPlaceholder("name@email.com").fill("test2@example.com");
  await f1.getByPlaceholder("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022").fill("secret1");
  await page.getByRole("button", { name: "\u062b\u0628\u062a\u200c\u0646\u0627\u0645", exact: true }).last().click();
  await page.waitForTimeout(1300);
  ok("second account signed up", await page.getByText(/\u0635\u0628\u062d \u0628\u062e\u06cc\u0631|\u0638\u0647\u0631 \u0628\u062e\u06cc\u0631|\u0639\u0635\u0631 \u0628\u062e\u06cc\u0631/).first().isVisible().catch(() => false));
  await page.getByRole("button", { name: /\u062e\u0631\u0648\u062c/ }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /\u0627\u062f\u0627\u0645\u0647 \u0628\u0627 \u06af\u0648\u06af\u0644/ }).click(); // back to the admin (demo) account
  await page.waitForTimeout(1000);
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1300);
  ok("new signup shows in users list within seconds", await page.getByText("test2@example.com").first().isVisible().catch(() => false));

  /* 15) a third non-admin account is blocked, and sees no data */
  await page.getByRole("button", { name: /\u062e\u0631\u0648\u062c/ }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "\u062b\u0628\u062a\u200c\u0646\u0627\u0645", exact: true }).first().click();
  await page.waitForTimeout(400);
  const f2v = page.locator("form");
  await f2v.getByPlaceholder("\u0645\u062b\u0644\u0627\u064b \u0633\u0627\u0631\u0627").fill("\u062a\u0633\u062a \u0633\u0648\u0645");
  await f2v.getByPlaceholder("name@email.com").fill("test3@example.com");
  await f2v.getByPlaceholder("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022").fill("secret2");
  await page.getByRole("button", { name: "\u062b\u0628\u062a\u200c\u0646\u0627\u0645", exact: true }).last().click();
  await page.waitForTimeout(1300);
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  ok("non-admin account blocked at /admin", await page.getByText("\u062f\u0633\u062a\u0631\u0633\u06cc \u0646\u062f\u0627\u0631\u06cc").first().isVisible().catch(() => false));
  const leakBody = await page.textContent("body");
  ok(
    "no other users' data leaks to the blocked account",
    !leakBody.includes("demo.google@lifeos.app") && !leakBody.includes("test2@example.com"),
  );

  // the deliberate 404 above shows up as a browser resource message — filter it out
  const realErrors = consoleErrors.filter((m) => !m.includes("Failed to load resource"));
  ok("no page errors", realErrors.length === 0, realErrors[0] ?? "");
} catch (e) {
  ok("fatal test error", false, String(e).slice(0, 300));
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);
