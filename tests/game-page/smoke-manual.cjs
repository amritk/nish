// MANUAL: not run by tests/run.js or CI. A smoke of runtime/page-game.mjs in a
// real Chromium, running the built examples/game-starter page:
//
//   node examples/game-starter/build.mjs
//   node tests/game-page/smoke-manual.cjs [build/game-starter]
//
// It needs Playwright and a Chromium it can launch (it installs neither). It
// serves the built directory and opens index.html once per tier (WebGPU when
// the browser offers it, WebGL 2 with `navigator.gpu` hidden, Canvas 2D with
// both GPU contexts refused). Each run reads the screen back at the paddle
// and the ball, holds ArrowLeft and checks the paddle moved on screen and in
// the module's storage, then presses space and checks the ball was served.
// A WebGPU whose queue never completes work (some headless builds) is
// reported, its pixels not checked; a browser with no WebGPU has that run
// reported as skipped.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..", "..");
const dir = path.resolve(root, process.argv[2] ?? "build/game-starter");

const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".wasm": "application/wasm", ".json": "application/json" };

const HIDE_GPU = `Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined });`;
const REFUSE_GPU_CONTEXTS = `${HIDE_GPU}
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, options) {
  return type === "webgpu" || type === "webgl2" ? null : getContext.call(this, type, options);
};`;

const runs = [
  { name: "WebGPU", init: "", needs: "webgpu" },
  { name: "navigator.gpu hidden (WebGL 2)", init: HIDE_GPU, needs: "webgl2" },
  { name: "both GPU contexts refused (Canvas 2D)", init: REFUSE_GPU_CONTEXTS, needs: "canvas2d" },
];

// The viewport is the game's 320x180 frame at scale 2, so frame pixel (x, y)
// is screen pixel (2x + 1, 2y + 1).
const VIEW = { width: 640, height: 360 };
const PADDLE_WHITE = 0xf0f0f0;
const BALL_YELLOW = 0xffd040;

// Whether this browser's WebGPU finishes queued work: null when it does, else why not.
const GPU_QUEUE_BROKEN = async () => {
  if (!navigator.gpu) {
    return null;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("onSubmittedWorkDone never resolved in 3 s")), 3000));
    device.queue.submit([device.createCommandEncoder().finish()]);
    // Not destroyed: in Chromium that loses the presenter's device too.
    await Promise.race([device.queue.onSubmittedWorkDone(), timeout]);
    return null;
  } catch (error) {
    return String(error && error.message ? error.message : error);
  }
};

// Decodes a PNG screenshot in the page and answers the 0xRRGGBB at each frame point.
const PIXELS_AT = async ([base64, points]) => {
  const blob = await (await fetch("data:image/png;base64," + base64)).blob();
  const bitmap = await createImageBitmap(blob);
  const copy = document.createElement("canvas");
  copy.width = bitmap.width;
  copy.height = bitmap.height;
  const ctx = copy.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return points.map(([x, y]) => {
    const d = ctx.getImageData(x * 2 + 1, y * 2 + 1, 1, 1).data;
    return (d[0] << 16) | (d[1] << 8) | d[2];
  });
};

const STATE = () => {
  const s = globalThis.game.module.views().storage;
  return { paddle: s.BALL[4], ballY: s.BALL[1], waiting: s.SCORE[2], backend: globalThis.game.presenter.backend };
};

const hex = (n) => n.toString(16).padStart(6, "0");
const frames = (page, n) =>
  page.evaluate((count) => new Promise((r) => {
    const tick = (left) => (left === 0 ? r() : requestAnimationFrame(() => tick(left - 1)));
    tick(count);
  }), n);

const main = async () => {
  if (!fs.existsSync(path.join(dir, "game.wasm"))) {
    console.error(`no game.wasm in ${dir}: run node examples/game-starter/build.mjs first`);
    process.exitCode = 1;
    return;
  }
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(dir, name === "/" ? "index.html" : name);
    if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-features=Vulkan", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });
  let failed = false;
  for (const run of runs) {
    const page = await browser.newPage({ viewport: VIEW });
    const logs = [];
    page.on("console", (m) => logs.push(m.text()));
    page.on("pageerror", (e) => logs.push(String(e)));
    if (run.init !== "") {
      await page.addInitScript(run.init);
    }
    await page.goto(url);
    await page.waitForFunction(() => typeof globalThis.game?.stop === "function", null, { timeout: 15000 });
    const start = await page.evaluate(STATE);
    const broken = await page.evaluate(GPU_QUEUE_BROKEN);
    const attempts = () => page.evaluate(() => game.presenter.attempts.map((a) => `${a.backend}: ${a.reason}`).join(" | "));
    console.log(`## ${run.name}`);
    // A WebGPU taken and then lost still runs the checks, on the tier it fell to.
    const lostGpu = run.needs === "webgpu" && (await attempts()).startsWith("webgpu: WebGPU device lost");
    if (start.backend !== run.needs && !lostGpu) {
      console.log(`skipped: no ${run.needs} in this browser (it presented with ${start.backend}; ${await attempts()})`);
      console.log("");
      await page.close();
      continue;
    }
    // A screen read while a broken WebGPU queue presents is reported, not counted.
    let excused = false;
    const read = async (points) => {
      await frames(page, 3);
      const png = await page.screenshot();
      excused = (await page.evaluate(STATE)).backend === "webgpu" && broken !== null;
      return page.evaluate(PIXELS_AT, [png.toString("base64"), points]);
    };
    const report = (what, ok) => {
      console.log(`${ok ? "ok" : "NOT OK"}  ${what}`);
      if (!(excused && what.startsWith("screen"))) {
        failed = failed || !ok;
      }
    };

    console.log(`backend: ${start.backend}`);
    const paddleX = Math.round(start.paddle);
    const [paddle, ball] = await read([[paddleX, 166], [paddleX, 159]]);
    report(`screen: the paddle at (${paddleX}, 166) is ${hex(paddle)}, want ${hex(PADDLE_WHITE)}`, paddle === PADDLE_WHITE);
    report(`screen: the waiting ball at (${paddleX}, 159) is ${hex(ball)}, want ${hex(BALL_YELLOW)}`, ball === BALL_YELLOW);

    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowLeft");
    const moved = await page.evaluate(STATE);
    report(`storage: ArrowLeft held 300 ms moved the paddle ${start.paddle} -> ${moved.paddle.toFixed(1)}`, moved.paddle < start.paddle - 40);
    const left = Math.round(moved.paddle);
    const [after, old] = await read([[left, 166], [paddleX + 20, 166]]);
    report(`screen: the paddle is now at ${left} (${hex(after)}), gone from ${paddleX + 20} (${hex(old)})`, after === PADDLE_WHITE && old !== PADDLE_WHITE);

    await page.keyboard.press(" ");
    await frames(page, 10);
    const served = await page.evaluate(STATE);
    report(`storage: space served the ball (waiting ${start.waiting} -> ${served.waiting}, y ${start.ballY} -> ${served.ballY.toFixed(1)})`, served.waiting === 0 && served.ballY < start.ballY);

    const rates = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return { fps: Math.round(globalThis.game.fps), refreshHz: Math.round(globalThis.game.refreshHz) };
    });
    console.log(`fps ${rates.fps}, refreshHz ${rates.refreshHz}`);
    const end = (await page.evaluate(STATE)).backend;
    if (end !== run.needs) {
      // Headless Chromium can drop its WebGPU device moments after the presenter takes it.
      console.log(`${run.needs} was lost during the run (${await attempts()}): the frames above were drawn by ${end}`);
    }
    if (broken !== null) {
      console.log(`this browser's WebGPU queue never completes work (${broken})${excused ? ": screen checks not counted" : ""}`);
    }
    if (logs.length > 0) {
      console.log(`console: ${logs.join(" | ")}`);
    }
    console.log("");
    await page.evaluate(() => globalThis.game.stop());
    await page.close();
  }
  await browser.close();
  server.close();
  process.exitCode = failed ? 1 : 0;
};

main();
