// Draws the app icons from the chosen option in design/labs/icon-lab.html ("The logo") and writes every file the
// app serves: src/app/icon.svg (browser tabs), src/app/favicon.ico (16/32/48), src/app/apple-icon.png (180, iOS
// rounds it), public/icons/icon-192.png and icon-512.png (rounded), maskable-512.png (Android crops it) and
// badge-96.png (notification badge: white on transparent, Android uses only its shape).
//
// The drawing lives in the lab, so the lab and the files never disagree. This opens the lab in headless Edge,
// asks it for the SVGs and rasterises them with a canvas there. Windows only (Edge's path), like the other
// local tools: `node design/icons/build-icons.mjs`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LAB = pathToFileURL(path.join(ROOT, "design/labs/icon-lab.html")).href + "#logo";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const port = 9800 + Math.floor(Math.random() * 100);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "two-couches-icons-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"]);

let wsUrl;
for (let i = 0; i < 150 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const waiting = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    waiting.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const { result } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
  return result.result.value;
};

await send("Page.enable");
await send("Page.navigate", { url: LAB });
await new Promise((r) => setTimeout(r, 1500));

// In the lab's page: OPTIONS and silhouette() are globals of its script.
const files = await evaluate(`(async () => {
  const o = OPTIONS.find((x) => x.id === "logo");
  const wrap = (body, rx = 0) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    (rx ? '<defs><clipPath id="r"><rect width="512" height="512" rx="' + rx + '"/></clipPath></defs><g clip-path="url(#r)">' + body + '</g>' : body) + '</svg>';
  // Badge: both couch shapes in white, the front one cut out of the back one so they stay two couches.
  const s = 440 / 123, x = 256 - 220, y = 256 - (440 * 50) / 123 / 2;
  const at = 'transform="translate(' + x + ' ' + y + ') scale(' + s + ')"';
  const cut = silhouette("black").replace('stroke-width="3"', 'stroke-width="7"');
  const badge = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">' +
    '<rect width="512" height="512" fill="white"/><g ' + at + '>' + cut + '</g></mask></defs>' +
    '<g mask="url(#cut)"><g ' + at + '><g transform="translate(59 0)">' + silhouette("white") + '</g></g></g>' +
    '<g ' + at + '>' + silhouette("white") + '</g></svg>';
  const svgs = {
    tab: wrap(o.draw(true), 96),
    tiny: wrap(o.draw(true), 80),
    full: wrap(o.draw(false)),
    rounded: wrap(o.draw(false), 112),
    maskable: wrap(o.maskable()),
    badge,
  };
  const png = (svg, px) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = px;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, px, px);
      resolve(canvas.toDataURL("image/png").split(",")[1]);
    };
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg ", '<svg width="' + px + '" height="' + px + '" '));
  });
  return {
    svg: svgs.tab,
    ico: [await png(svgs.tiny, 16), await png(svgs.tiny, 32), await png(svgs.rounded, 48)],
    apple: await png(svgs.full, 180),
    icon192: await png(svgs.rounded, 192),
    icon512: await png(svgs.rounded, 512),
    maskable: await png(svgs.maskable, 512),
    badge: await png(svgs.badge, 96),
  };
})()`);

await send("Browser.close").catch(() => {});
await Promise.race([new Promise((r) => edge.once("exit", r)), new Promise((r) => setTimeout(r, 3000))]);
edge.kill();

/** An .ico holding PNG images (Vista and later read PNG entries). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const size = png.readUInt32BE(16); // IHDR width
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
}

const b = (data) => Buffer.from(data, "base64");
const out = {
  "src/app/icon.svg": Buffer.from(files.svg + "\n"),
  "src/app/favicon.ico": ico(files.ico.map(b)),
  "src/app/apple-icon.png": b(files.apple),
  "public/icons/icon-192.png": b(files.icon192),
  "public/icons/icon-512.png": b(files.icon512),
  "public/icons/maskable-512.png": b(files.maskable),
  "public/icons/badge-96.png": b(files.badge),
};
for (const [file, data] of Object.entries(out)) {
  fs.writeFileSync(path.join(ROOT, file), data);
  console.log(file, data.length, "bytes");
}
try {
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
} catch {
  console.log("left Edge's temporary profile at", profile);
}
process.exit(0);
