import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("video");
fs.rmSync(OUT, { recursive: true, force: true });
const W = 1440, H = 900;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});

// Fake cursor + caption layer (headless video has no OS cursor)
await ctx.addInitScript(() => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#1C2B39" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    Object.assign(c.style, { position: "fixed", left: "-50px", top: "-50px", zIndex: 2147483647, pointerEvents: "none", transition: "transform 80ms" });
    document.documentElement.appendChild(c);
    const cap = document.createElement("div");
    cap.id = "__cap";
    Object.assign(cap.style, {
      position: "fixed", left: "50%", bottom: "46px", transform: "translateX(-50%) translateY(10px)",
      zIndex: 2147483646, pointerEvents: "none", opacity: "0", transition: "opacity 300ms, transform 300ms",
      background: "rgba(28,43,57,0.92)", color: "#fff", padding: "12px 22px", borderRadius: "10px",
      font: '500 18px "IBM Plex Sans", system-ui, sans-serif', boxShadow: "0 6px 24px rgba(0,0,0,.18)",
      maxWidth: "900px", textAlign: "center", lineHeight: "1.4",
    });
    document.documentElement.appendChild(cap);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(0.8)"), true);
    addEventListener("mouseup", () => (c.style.transform = "scale(1)"), true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
});

const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
let mx = W / 2, my = H / 2;

async function moveTo(x, y, steps = 25) {
  await page.mouse.move(x, y, { steps });
  mx = x; my = y;
}
async function clickAt(x, y) {
  await moveTo(x, y);
  await wait(250);
  await page.mouse.down(); await wait(80); await page.mouse.up();
}
async function clickEl(locator) {
  const b = await locator.boundingBox();
  await clickAt(b.x + b.width / 2, b.y + b.height / 2);
}
async function caption(text, hold = 0) {
  await page.evaluate((t) => {
    const cap = document.getElementById("__cap");
    if (!cap) return;
    if (!t) { cap.style.opacity = "0"; cap.style.transform = "translateX(-50%) translateY(10px)"; return; }
    cap.textContent = t; cap.style.opacity = "1"; cap.style.transform = "translateX(-50%) translateY(0)";
  }, text);
  if (hold) await wait(hold);
}
async function typeSlow(text) {
  for (const ch of text) { await page.keyboard.type(ch); await wait(45); }
}
// Screen coords of a graph node by its label
async function nodePos(label) {
  return page.evaluate((label) => {
    const el = [...document.querySelectorAll("div")].find((d) => d._cyreg?.cy);
    const cy = el._cyreg.cy;
    const n = cy.nodes().filter((n) => n.data("label") === label || n.data("fullLabel") === label)[0]
      ?? cy.nodes().filter((n) => (n.data("label") || "").startsWith(label.slice(0, 12)))[0];
    if (!n) return null;
    const r = el.getBoundingClientRect(); const p = n.renderedPosition();
    return { x: r.left + p.x, y: r.top + p.y };
  }, label);
}
async function clickNode(label) {
  const p = await nodePos(label);
  if (!p) throw new Error("node not found: " + label);
  await clickAt(p.x, p.y);
}
async function hoverNode(label, hold = 900) {
  const p = await nodePos(label);
  if (!p) return;
  await moveTo(p.x, p.y, 30);
  await wait(hold);
}

// ---------------------------------------------------------------- 1. Home
await page.goto("http://localhost:5173/");
await page.waitForLoadState("networkidle");
await wait(1200);
await caption("ClauseMap: turn any contract into a map you can cite", 2600);
const drop = page.getByText("Drop a PDF here or choose a file");
const db = await drop.boundingBox(); await moveTo(db.x + db.width / 2, db.y + db.height / 2, 35);

await moveTo((await drop.boundingBox()).x + 200, (await drop.boundingBox()).y + 30);
await caption("Drop in a PDF and an LLM extracts parties, obligations, dates & amounts", 2800);
await caption("Let's open a demo: a 20-page supply agreement", 1400);
await clickEl(page.getByRole("button", { name: /Supply Agreement/ }));

// ---------------------------------------------------------------- 2. Map
await page.waitForFunction(() => [...document.querySelectorAll("div")].some((d) => d._cyreg?.cy));
await caption("", 0);
await wait(2500);
await caption("Every party, obligation, date and amount, laid out as one network", 3000);
await caption("Hover any node to trace who owes what to whom", 600);
await hoverNode("TechCorp Ltd.", 1300);
await hoverNode("Meridian Supplies B.V.", 1300);
await hoverNode("pay invoices within 30 days", 1300);

// ---------------------------------------------------------------- 3. Evidence
await caption("Click a node to see the exact sentences it came from, with page numbers", 400);
await clickNode("TechCorp Ltd.");
await wait(3200);
const panel = page.locator("div.panel-in");
await moveTo(W - 250, 400, 30);
await page.mouse.wheel(0, 300); await wait(1500);
await page.mouse.wheel(0, -300); await wait(800);

// linked node inside panel
await caption("Jump along connections straight from the panel", 400);
const linkBtn = panel.locator("button", { hasText: /pay invoices|Meridian/ }).first();
if (await linkBtn.count()) { await clickEl(linkBtn); await wait(3000); }
await clickEl(page.getByLabel("Close panel"));
await wait(800);

// ---------------------------------------------------------------- 4. Filters
await caption("Filter by type to focus on just the parties and obligations", 400);
for (const t of [/^Dates/, /^Amounts/, /^Topics/]) {
  await clickEl(page.locator("header button[aria-pressed]", { hasText: t }));
  await wait(900);
}
await wait(1600);
for (const t of [/^Topics/, /^Amounts/, /^Dates/]) {
  await clickEl(page.locator("header button[aria-pressed]", { hasText: t }));
  await wait(500);
}
await wait(1000);

const more = page.locator("header button", { hasText: /^Show \d+ more/ });
if (await more.count()) {
  await caption("Big documents open as an overview. Expand to see everything", 400);
  await clickEl(more); await wait(2500);
}

// ---------------------------------------------------------------- 5. Search
await caption("Search for anything by name", 400);
const search = page.getByPlaceholder("Find a party, date, amount…");
await clickEl(search);
await typeSlow("Escrow Agent");
await page.keyboard.press("Enter");
await wait(3000);
await clickEl(page.getByLabel("Close panel"));

// ---------------------------------------------------------------- 6. Zoom
await caption("Zoom and pan like a map", 300);
await clickEl(page.getByTitle("Zoom in")); await wait(500);
await clickEl(page.getByTitle("Zoom in")); await wait(900);
await moveTo(500, 500);
await page.mouse.down(); await moveTo(650, 420, 30); await page.mouse.up();
await wait(800);
await clickEl(page.getByTitle("Fit")); await wait(1200);

// ---------------------------------------------------------------- 7. How it was made
await caption("Transparent: see exactly how the map was built", 300);
await clickEl(page.getByRole("button", { name: /How this map was made/ }));
await wait(3000);

// ---------------------------------------------------------------- 8. Ask
await caption("Ask questions in plain English. Answers are grounded in the text", 400);
const ask = page.getByPlaceholder("Ask about this document…");
await clickEl(ask);
await typeSlow("What happens if TechCorp pays an invoice late?");
await wait(400);
await clickEl(page.getByRole("button", { name: "Ask", exact: true }));
await caption("Answers cite their source and light up the relevant part of the map", 0);
await page.waitForFunction(() => !document.querySelector('input[placeholder="Ask about this document…"]').disabled, null, { timeout: 45000 });
await wait(4500);
await moveTo(W - 300, H - 250, 30);
await wait(1500);

// ---------------------------------------------------------------- 9. Outro
await caption("ClauseMap: see the whole deal. Cite every line.", 3500);
await caption("", 800);

const video = page.video();
await ctx.close();
await browser.close();
const src = await video.path();
fs.renameSync(src, path.join(OUT, "clausemap-demo.webm"));
console.log("saved", path.join(OUT, "clausemap-demo.webm"));
