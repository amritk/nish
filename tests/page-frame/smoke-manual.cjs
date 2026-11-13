// MANUAL: not run by tests/run.js or CI. A smoke of runtime/page-frame.mjs in
// a real Chromium, for a change to the presenter to be tried with:
//
//   node tests/page-frame/smoke-manual.cjs
//
// It needs Playwright and a Chromium it can launch (it installs neither). It
// presents an 8x4 test pattern on a 64x48 canvas once per tier (WebGPU when
// the browser offers it, WebGL 2 with `navigator.gpu` hidden, Canvas 2D with
// both GPU contexts refused), reads the canvas back, and prints the pixels it
// expected and found at the centre of each pattern cell, plus the letterbox,
// read from a screenshot of the canvas. A WebGPU whose queue never completes
// work (some headless builds) is reported, its pixels not checked.
// A last run loses the WebGL 2 context and checks the fall to Canvas 2D.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..", "..");

const PAGE = `<!doctype html>
<html><body style="margin:0">
<canvas id="screen" class="frame" width="64" height="48"></canvas>
<script type="module">
import { createPresenter, runFixedStep } from "/runtime/page-frame.mjs";

// 8x4, each cell a known colour: the hues, then greys and mixes.
const colours = [
  0xff0000, 0x00ff00, 0x0000ff, 0xffffff, 0x000000, 0x808080, 0x123456, 0xffff00,
  0x00ffff, 0xff00ff, 0x400000, 0x004000, 0x000040, 0xc0c0c0, 0xabcdef, 0x0f0f0f,
  0x7f7f7f, 0xfedcba, 0x010203, 0xa0a0a0, 0x33cc33, 0xcc3333, 0x3333cc, 0x999999,
  0xf0f0f0, 0x20e020, 0xe02020, 0x2020e0, 0x0a0b0c, 0x55aa55, 0xaa55aa, 0x5555aa,
];
const pixels = Int32Array.from(colours);

// The pixels come from a screenshot of the canvas, decoded here: what was
// composited on screen, whichever tier drew it.
window.decode = async (base64) => {
  const blob = await (await fetch("data:image/png;base64," + base64)).blob();
  const bitmap = await createImageBitmap(blob);
  const copy = document.createElement("canvas");
  copy.width = bitmap.width;
  copy.height = bitmap.height;
  const ctx = copy.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const at = (x, y) => (y * bitmap.width + x) * 4;
  // 64x48 holding 8x4 at scale 8: 64x32, with 8 rows of black above and below.
  const cells = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 8; x++) {
      const i = at(x * 8 + 4, 8 + y * 8 + 4);
      cells.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
  }
  const border = [at(0, 0), at(30, 3), at(63, 47)].map((i) => [data[i], data[i + 1], data[i + 2], data[i + 3]]);
  return { size: bitmap.width + "x" + bitmap.height, cells, border };
};

let presenter = null;
const falls = [];

// Whether this browser's WebGPU finishes queued work at all: some headless
// builds hand out a device whose queue never completes, and then no pixel
// WebGPU draws can be read. Answers null when it does, else why not.
window.gpuQueueBroken = async () => {
  if (!navigator.gpu) {
    return null;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = document.createElement("canvas").getContext("webgpu");
    context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: "opaque" });
    const encoder = device.createCommandEncoder();
    encoder
      .beginRenderPass({
        colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store" }],
      })
      .end();
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    device.destroy();
    return null;
  } catch (error) {
    return String(error && error.message ? error.message : error);
  }
};

window.start = async (prefer) => {
  presenter = await createPresenter(document.getElementById("screen"), {
    prefer,
    onFallback: (from, to, reason) => falls.push(from + " -> " + to + ": " + reason),
  });
  presenter.present(pixels, 8, 4);
  return {
    backend: presenter.backend,
    attempts: presenter.attempts.map((a) => a.backend + ": " + a.reason),
    expected: colours,
  };
};

window.loseWebGl = async () => {
  presenter.canvas.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext();
  await new Promise((r) => setTimeout(r, 50));
  presenter.present(pixels, 8, 4);
  return {
    backend: presenter.backend,
    falls: falls.slice(),
    canvasKept: presenter.canvas.id === "screen" && presenter.canvas.className === "frame",
  };
};

window.runLoop = async () => {
  let renders = 0;
  let steps = 0;
  const loop = runFixedStep({
    stepsPerSecond: 60,
    step: () => steps++,
    render: () => {
      renders++;
      presenter.present(pixels, 8, 4);
    },
  });
  await new Promise((r) => setTimeout(r, 1500));
  loop.stop();
  const result = { renders, steps, refreshHz: Math.round(loop.refreshHz), fps: Math.round(loop.fps) };
  presenter.destroy();
  return result;
};
window.ready = true;
</script></body></html>`;

const HIDE_GPU = `Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined });`;
const REFUSE_GPU_CONTEXTS = `${HIDE_GPU}
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, options) {
  return type === "webgpu" || type === "webgl2" ? null : getContext.call(this, type, options);
};`;

const runs = [
  { name: "WebGPU", init: "", prefer: "webgpu" },
  { name: "navigator.gpu hidden (WebGL 2, then its context lost)", init: HIDE_GPU, prefer: "webgpu" },
  { name: "both GPU contexts refused (Canvas 2D)", init: REFUSE_GPU_CONTEXTS, prefer: "webgpu" },
];

const hex = (n) => n.toString(16).padStart(6, "0");

const main = async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(PAGE);
      return;
    }
    if (req.url === "/runtime/page-frame.mjs") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(fs.readFileSync(path.join(root, "runtime", "page-frame.mjs")));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan", "--enable-unsafe-swiftshader"],
  });
  let failed = false;
  for (const run of runs) {
    const page = await browser.newPage();
    const logs = [];
    page.on("console", (m) => logs.push(m.text()));
    page.on("pageerror", (e) => logs.push(String(e)));
    if (run.init !== "") {
      await page.addInitScript(run.init);
    }
    await page.goto(url);
    await page.waitForFunction(() => window.ready === true);
    const broken = await page.evaluate(() => window.gpuQueueBroken());
    const started = await page.evaluate((prefer) => window.start(prefer), run.prefer);
    const read = async () => {
      // Two animation frames, so the frame presented is the one composited.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const png = await page.locator("#screen").screenshot();
      return page.evaluate((b64) => window.decode(b64), png.toString("base64"));
    };
    const shot = await read();
    const mismatched = shot.cells.filter((c, i) => c !== started.expected[i]).length;
    const borderBlack = shot.border.every((p) => p[0] === 0 && p[1] === 0 && p[2] === 0 && p[3] === 255);
    console.log(`## ${run.name}`);
    console.log(`backend: ${started.backend}`);
    console.log(`attempts: ${started.attempts.length === 0 ? "(none)" : started.attempts.join(" | ")}`);
    console.log(`screenshot ${shot.size}: ${32 - mismatched}/32 cells match; letterbox black: ${borderBlack}`);
    console.log(`  expected ${started.expected.map(hex).join(" ")}`);
    console.log(`  read     ${shot.cells.map(hex).join(" ")}`);
    if (started.backend === "webgpu" && broken !== null) {
      console.log(`  not checked: this browser's WebGPU queue never completes work (${broken})`);
    } else {
      failed = failed || mismatched !== 0 || !borderBlack;
    }
    if (started.backend === "webgl2") {
      const lost = await page.evaluate(() => window.loseWebGl());
      const after = await read();
      const lossMismatched = after.cells.filter((c, i) => c !== started.expected[i]).length;
      console.log(
        `after loseContext(): backend ${lost.backend}, ${32 - lossMismatched}/32 cells match, ` +
          `fresh canvas keeps id and class: ${lost.canvasKept}`
      );
      console.log(`  onFallback: ${lost.falls.join(" | ")}`);
      failed = failed || lossMismatched !== 0 || lost.backend !== "canvas2d" || !lost.canvasKept;
    }
    const loop = await page.evaluate(() => window.runLoop());
    console.log(`loop over 1.5 s: ${loop.renders} renders, ${loop.steps} steps, refreshHz ${loop.refreshHz}, fps ${loop.fps}`);
    if (logs.length > 0) {
      console.log(`console: ${logs.join(" | ")}`);
    }
    console.log("");
    await page.close();
  }
  await browser.close();
  server.close();
  process.exitCode = failed ? 1 : 0;
};

main();
