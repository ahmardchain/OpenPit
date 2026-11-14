/**
 * Records the OpenPit demo video straight from the running app, with captions and (optionally) a voiceover.
 *
 *   BASE_URL=https://your-worker.workers.dev node scripts/record-demo.mjs
 *   BASE_URL=http://localhost:3000 node scripts/record-demo.mjs        (default)
 *
 * Narration lives in demo-src/narration.json (one line per scene). Put a voice clip per scene at
 * demo-src/voice/<scene id>.mp3 and each scene is held exactly as long as its clip, the clips are mixed in at
 * the moment their caption appears, and demo/openpit-demo.srt is written from the same timestamps.
 * Without clips the timing is estimated from the text and the video is silent with captions.
 *
 * Every number on screen is live: the paper pit is opened and joined through the public API at the current
 * dreamDEX mark, and the settled pit (REAL_PIT) is the real two-wallet on-chain run. Needs ffmpeg on PATH.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Playwright is not a project dependency: `npm i -D playwright && npx playwright install chromium`, or use a global copy.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const REAL_PIT = process.env.REAL_PIT ?? "e62795e1ee";
const REAL_OPEN_TX = process.env.REAL_OPEN_TX ?? "0x940bd096e07cf65f200beb317f9796cf5569b9067b98f3c000b7da09d185e3bc";
const EXPLORER = "https://explorer.testnet.somnia.network/tokyo";
const OUT = path.resolve("demo");
const VOICE = path.resolve("demo-src/voice");
const W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const narration = JSON.parse(readFileSync(path.resolve("demo-src/narration.json"), "utf8")).scenes;
const lines = Object.fromEntries(narration.map((s) => [s.id, s.text]));

function clipFor(id) {
  for (const ext of [".mp3", ".wav", ".m4a"]) {
    const f = path.join(VOICE, id + ext);
    if (existsSync(f)) return f;
  }
  return null;
}
function seconds(file) {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
}
/** How long a scene must stay on screen: the clip's length, or a reading-speed estimate. */
function holdFor(id) {
  const clip = clipFor(id);
  return clip ? seconds(clip) + 0.5 : Math.max(3.5, lines[id].length / 14.5 + 0.6);
}

// Caption bar + visible cursor, re-created on every page (headless video has no cursor of its own).
const overlay = () => {
  const install = () => {
    if (document.getElementById("__demo_cap")) return;
    const cap = document.createElement("div");
    cap.id = "__demo_cap";
    Object.assign(cap.style, {
      position: "fixed", left: "50%", bottom: "26px", transform: "translateX(-50%)", zIndex: 2147483647,
      width: "min(1040px, calc(100vw - 80px))", padding: "12px 22px", borderRadius: "8px", background: "rgba(12,22,48,.9)", color: "#fff",
      font: "500 21px/1.4 'IBM Plex Sans', system-ui, sans-serif", textAlign: "center", pointerEvents: "none",
      transition: "opacity .2s", opacity: "0",
    });
    const dot = document.createElement("div");
    dot.id = "__demo_cursor";
    Object.assign(dot.style, {
      position: "fixed", left: "-40px", top: "-40px", width: "18px", height: "18px", marginLeft: "-9px", marginTop: "-9px",
      borderRadius: "50%", background: "rgba(31,94,255,.3)", border: "2px solid #1f5eff", zIndex: 2147483647, pointerEvents: "none",
      transition: "transform .12s",
    });
    document.documentElement.append(cap, dot);
    addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { dot.style.transform = "scale(.7)"; }, true);
    addEventListener("mouseup", () => { dot.style.transform = "scale(1)"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
};

async function setCaption(page, text) {
  await page.waitForFunction(() => !!document.getElementById("__demo_cap"), null, { timeout: 10_000 }).catch(() => {});
  await page.evaluate((t) => {
    const cap = document.getElementById("__demo_cap");
    if (!cap) return;
    cap.textContent = t;
    cap.style.opacity = t ? "1" : "0";
  }, text);
}

async function moveAndClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
    await sleep(200);
  }
  await locator.click();
}

async function smoothScroll(page, y, ms = 1200) {
  await page.evaluate(
    ([to, dur]) =>
      new Promise((done) => {
        const from = scrollY, t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          scrollTo(0, from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
          k < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
}

async function api(p, body) {
  const r = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${p}: ${j.error ?? r.status}`);
  return j;
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  await context.addInitScript(overlay);
  const page = await context.newPage();
  const t0 = Date.now();
  const cues = [];

  /** Show a scene's caption, run its actions, and hold until its voice clip (or estimate) has finished. */
  async function scene(id, during = async () => {}) {
    const hold = holdFor(id);
    await setCaption(page, lines[id]);
    const start = (Date.now() - t0) / 1000;
    const ends = Date.now() + hold * 1000;
    await during();
    const left = ends - Date.now();
    if (left > 0) await sleep(left);
    cues.push({ id, start, end: (Date.now() - t0) / 1000 });
    await setCaption(page, "");
    await sleep(250);
  }

  const tag = Math.floor(Math.random() * 90 + 10);
  let pitId = "";

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(600);
  await scene("01-intro", async () => {
    await sleep(2500);
    await smoothScroll(page, 300, 1500);
    await sleep(1200);
    await smoothScroll(page, 0, 1200);
  });

  await scene("02-create", async () => {
    await moveAndClick(page, page.getByRole("link", { name: "Open a pit" }).first());
    await page.waitForURL("**/new");
    await page.waitForSelector("text=ETH");
    await setCaption(page, lines["02-create"]);
    await moveAndClick(page, page.locator("#name"));
    await page.keyboard.type(`ahmad${tag}`, { delay: 60 });
    await moveAndClick(page, page.getByRole("button", { name: "ETH", exact: true }));
    await sleep(500);
    await moveAndClick(page, page.getByRole("button", { name: "Long", exact: true }));
    await moveAndClick(page, page.getByRole("button", { name: "5 min", exact: true }));
    await moveAndClick(page, page.locator("#thesis"));
    await page.keyboard.type("Funding flipped negative, shorts are crowded", { delay: 30 });
  });

  await moveAndClick(page, page.getByRole("button", { name: /Open 5-minute pit/ }));
  await page.waitForURL("**/pit/*", { timeout: 30_000 });
  pitId = page.url().split("/pit/")[1];
  await page.waitForSelector("text=Standings", { timeout: 30_000 });
  await sleep(800);

  await scene("03-reactivity", async () => {
    const price = page.getByText("Mark", { exact: true }).first();
    const box = await price.boundingBox();
    if (box) await page.mouse.move(box.x + 60, box.y + 30, { steps: 20 });
  });

  await scene("04-crowd", async () => {
    for (const [name, side] of [["kenji", "long"], ["mira", "short"], ["dex_fan", "short"], ["0xbeth", "short"]]) {
      await api(`/api/pits/${pitId}/join`, { mode: "demo", name: `${name}${tag}`, side });
      await sleep(1800);
    }
  });

  await scene("05-scoring", async () => {
    await smoothScroll(page, 330, 1400);
  });

  await page.goto(`${BASE}/pit/${REAL_PIT}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Standings", { timeout: 30_000 });
  await sleep(500);
  await scene("06-real-pit");

  await scene("07-verify", async () => {
    await smoothScroll(page, 560, 1500);
    const link = page.getByRole("link", { name: "order tx" }).first();
    const box = await link.boundingBox().catch(() => null);
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  });

  await page.goto(`${EXPLORER}/tx/${REAL_OPEN_TX}`, { waitUntil: "domcontentloaded" });
  await sleep(3500);
  await scene("08-explorer");

  await page.goto(`${BASE}/api/og/${REAL_PIT}`, { waitUntil: "load" });
  await sleep(400);
  await scene("09-share");

  await page.goto(`${BASE}/pit/${pitId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Standings", { timeout: 30_000 });
  await sleep(400);
  await scene("10-close");
  await sleep(600);

  const video = page.video();
  await context.close();
  await browser.close();
  const raw = path.join(OUT, "openpit-demo.webm");
  renameSync(await video.path(), raw);
  for (const f of readdirSync(OUT)) if (f.endsWith(".webm") && f !== "openpit-demo.webm") rmSync(path.join(OUT, f));

  // Captions file from the real timestamps.
  const ts = (s) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  writeFileSync(path.join(OUT, "openpit-demo.srt"), cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${lines[c.id]}\n`).join("\n"));

  // Voice track: each clip placed where its caption appeared.
  const voiced = cues.filter((c) => clipFor(c.id));
  const mp4 = path.join(OUT, "openpit-demo.mp4");
  const venc = ["-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  if (voiced.length) {
    const inputs = voiced.flatMap((c) => ["-i", clipFor(c.id)]);
    const delays = voiced.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.start * 1000)}|${Math.round(c.start * 1000)}[a${i}]`);
    const mix = `${voiced.map((_, i) => `[a${i}]`).join("")}amix=inputs=${voiced.length}:normalize=0,apad[aout]`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, ...inputs, "-filter_complex", [...delays, mix].join(";"), "-map", "0:v", "-map", "[aout]", ...venc, "-c:a", "aac", "-b:a", "160k", "-shortest", mp4]);
  } else {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, ...venc, mp4]);
  }
  console.log(`Recorded ${mp4} (${voiced.length}/${narration.length} scenes voiced, pit ${pitId})`);
  console.log(`Captions ${path.join(OUT, "openpit-demo.srt")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
