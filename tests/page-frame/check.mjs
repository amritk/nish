// Runs runtime/page-frame.mjs under Node against the fakes in fakes.mjs and
// prints one `ok <name>` or `not ok <name>\t<detail>` line per check, then
// `checks: <n>`; the `page-frame` section of tests/run.js turns each line into
// a check of its own and compares the count, so a run cut short is caught.

import { createPresenter, runFixedStep } from "../../runtime/page-frame.mjs";
import { installClock, World } from "./fakes.mjs";

const results = [];
const check = (name, ok, detail) => {
  results.push(ok ? `ok ${name}` : `not ok ${name}\t${detail === undefined ? "" : detail}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A presenter in `world`, with every `onFallback` call recorded in `falls`. */
const open = async (world, prefer) => {
  world.install();
  const falls = [];
  const options = {
    onFallback: (from, to, reason) => {
      falls.push([from, to, reason]);
    },
  };
  if (prefer !== undefined) {
    options.prefer = prefer;
  }
  const presenter = await createPresenter(world.canvas, options);
  return { presenter, falls };
};

const reasons = (presenter) => presenter.attempts.map((a) => [a.backend, a.reason]);

// --- Tier order and refusals -------------------------------------------------

{
  const world = new World();
  const { presenter, falls } = await open(world);
  check("tier order: WebGPU first when everything works", presenter.backend === "webgpu", presenter.backend);
  check("tier order: nothing refused, nothing reported", presenter.attempts.length === 0 && falls.length === 0);
  check(
    "webgpu: the context is opaque, in the preferred format",
    world.gpuContext.configured.alphaMode === "opaque" && world.gpuContext.configured.format === "bgra8unorm",
    JSON.stringify(world.gpuContext.configured)
  );
  check(
    "webgpu: nearest sampling",
    world.sampler.magFilter === "nearest" && world.sampler.minFilter === "nearest",
    JSON.stringify(world.sampler)
  );
  check(
    "webgpu: alpha forced to 1 in the shader",
    world.pipeline.vertex.module.code.includes("textureSample(frame, nearest, in.uv).rgb, 1.0")
  );
}

const refusals = [
  ["navigator.gpu missing", { gpu: false }, "navigator.gpu is missing"],
  ["requestAdapter answering null", { adapter: null }, "requestAdapter answered null"],
  ["requestAdapter rejecting", { adapter: "throw" }, "requestAdapter rejected: fake adapter failure"],
  ["requestDevice rejecting", { deviceFails: true }, "requestDevice rejected: fake device failure"],
  ['getContext("webgpu") answering null', { contexts: ["webgl2", "2d"] }, 'getContext("webgpu") answered null'],
];
for (const [name, settings, reason] of refusals) {
  const world = new World(settings);
  const { presenter, falls } = await open(world);
  check(`refusal recorded: ${name}`, same(reasons(presenter), [["webgpu", reason]]), JSON.stringify(reasons(presenter)));
  check(`refusal reported: ${name}`, same(falls, [["webgpu", "webgl2", reason]]), JSON.stringify(falls));
  check(`refusal falls to WebGL 2: ${name}`, presenter.backend === "webgl2", presenter.backend);
  check(
    `refusal before a context keeps the canvas: ${name}`,
    world.current === world.canvas && presenter.canvas === world.canvas
  );
}

{
  const world = new World({ contexts: ["webgl2", "2d"] });
  await open(world);
  check(
    'webgpu: a device made before getContext("webgpu") refused is destroyed',
    world.device !== null && world.device.destroyed
  );
}

{
  // The pipeline refuses after the canvas has handed out a "webgpu" context,
  // which it keeps: WebGL 2 needs a fresh canvas.
  const world = new World({ pipelineFails: true });
  const { presenter } = await open(world);
  check("refusal after getContext: WebGL 2 on a fresh canvas", presenter.backend === "webgl2", presenter.backend);
  check(
    "refusal after getContext: the fresh canvas replaces the old one in the page",
    world.current !== world.canvas && presenter.canvas === world.current
  );
  check(
    "refusal after getContext: the fresh canvas keeps id, class and style",
    same(world.current.attributes, world.canvas.attributes)
  );
  check(
    "refusal after getContext: the reason names the pipeline",
    presenter.attempts[0].reason.includes("fake pipeline error"),
    presenter.attempts[0].reason
  );
  check(
    "refusal after getContext: the refused WebGPU context is unconfigured and its device destroyed",
    world.gpuContext.unconfigured === 1 && world.gpuContext.configured === null && world.device.destroyed
  );
}

{
  // At creation `presenter` does not exist yet: the callback's own argument
  // is how it reaches the fresh canvas.
  const world = new World({ pipelineFails: true }).install();
  const seen = [];
  const presenter = await createPresenter(world.canvas, {
    onFallback: (from, to, reason, canvas) => {
      seen.push([from, to, canvas]);
    },
  });
  check(
    "onFallback at creation: passed the fresh canvas the next tier builds on",
    seen.length === 1 &&
      seen[0][0] === "webgpu" &&
      seen[0][1] === "webgl2" &&
      seen[0][2] === world.current &&
      seen[0][2] !== world.canvas &&
      presenter.canvas === seen[0][2]
  );
}

{
  // A canvas outside the document: the fresh one is outside it too.
  const world = new World({ pipelineFails: true }).install();
  world.page.children = [];
  world.canvas.parent = null;
  let passed = null;
  const presenter = await createPresenter(world.canvas, {
    onFallback: (from, to, reason, canvas) => {
      passed = canvas;
    },
  });
  check(
    "a canvas with no parent: the fallback builds on a detached fresh canvas",
    presenter.backend === "webgl2" &&
      presenter.canvas !== world.canvas &&
      presenter.canvas.parent === null &&
      presenter.canvas.mode === "webgl2" &&
      passed === presenter.canvas,
    presenter.backend
  );
}

{
  const world = new World({ contexts: ["2d"] });
  const { presenter, falls } = await open(world);
  check("tier order: Canvas 2D when both GPU contexts refuse", presenter.backend === "canvas2d", presenter.backend);
  check(
    "tier order: both refusals recorded and reported",
    same(
      falls.map((f) => [f[0], f[1]]),
      [
        ["webgpu", "webgl2"],
        ["webgl2", "canvas2d"],
      ]
    ) && same(reasons(presenter)[1], ["webgl2", 'getContext("webgl2") answered null']),
    JSON.stringify(falls)
  );
}

{
  const world = new World({ glCompiles: false, contexts: ["webgl2", "2d"] });
  const { presenter } = await open(world, "webgl2");
  check(
    "refusal recorded: a WebGL 2 shader that does not compile",
    presenter.backend === "canvas2d" && presenter.attempts[0].reason.includes("fake compile log"),
    JSON.stringify(reasons(presenter))
  );
}

{
  const world = new World({ programLinks: false });
  const { presenter, falls } = await open(world, "webgl2");
  check(
    "refusal recorded: a WebGL 2 program that does not link",
    same(reasons(presenter), [["webgl2", "the WebGL 2 program did not link: fake link log"]]),
    JSON.stringify(reasons(presenter))
  );
  check(
    "refusal after a WebGL 2 context: Canvas 2D on a fresh canvas",
    presenter.backend === "canvas2d" &&
      same(falls, [["webgl2", "canvas2d", "the WebGL 2 program did not link: fake link log"]]) &&
      world.current !== world.canvas &&
      presenter.canvas === world.current,
    JSON.stringify(falls)
  );
  check(
    "refusal after a WebGL 2 context: its shaders and program are deleted and the context is lost",
    world.count.glShadersDeleted === 2 &&
      world.count.glProgramsDeleted === 1 &&
      world.count.glContextsLost === 1 &&
      world.canvas.context.isContextLost(),
    JSON.stringify(world.count)
  );
}

{
  const world = new World({ glLostAtStart: true });
  const { presenter } = await open(world, "webgl2");
  check(
    "refusal recorded: a WebGL 2 context lost before it was used",
    presenter.backend === "canvas2d" &&
      same(reasons(presenter), [["webgl2", "the WebGL 2 context was lost before it was used"]]),
    JSON.stringify(reasons(presenter))
  );
}

for (const [name, settings, cause] of [
  ["configure throwing", { configureFails: true }, "fake configure error"],
  ["createShaderModule throwing", { shaderModuleFails: true }, "fake shader module error"],
]) {
  const world = new World(settings);
  const { presenter } = await open(world);
  check(
    `refusal recorded: ${name}`,
    same(reasons(presenter), [["webgpu", `the WebGPU pipeline did not build: ${cause}`]]),
    JSON.stringify(reasons(presenter))
  );
  check(
    `refusal falls to WebGL 2 on a fresh canvas: ${name}`,
    presenter.backend === "webgl2" && world.current !== world.canvas && world.device.destroyed,
    presenter.backend
  );
}

{
  const world = new World({ offscreen2d: false });
  world.install();
  let error = null;
  try {
    await createPresenter(world.canvas, { prefer: "canvas2d" });
  } catch (e) {
    error = e;
  }
  const message = error === null ? "" : error.message;
  check(
    "refusal recorded: the framebuffer-sized canvas refusing a 2D context",
    message === 'nish/page/frame: no backend could present: canvas2d: the framebuffer-sized canvas answered null to getContext("2d")',
    message
  );
}

for (const [name, lose, reason] of [
  ["device lost", (device) => device.loseNow("unknown", "fake loss"), "WebGPU device lost (unknown): fake loss"],
  ["uncaptured error", (device) => device.raise("fake early error"), "uncaptured WebGPU error: fake early error"],
]) {
  // The device ends while its pipeline is still building: the tier is never
  // taken, and WebGL 2 builds instead.
  const world = new World({ pipelineGated: true });
  world.install();
  const falls = [];
  const made = createPresenter(world.canvas, { onFallback: (from, to, why) => falls.push([from, to, why]) });
  await settle();
  lose(world.device);
  world.finishPipeline();
  const presenter = await made;
  check(
    `${name} while the pipeline builds: falls to WebGL 2 with the reason`,
    presenter.backend === "webgl2" &&
      same(reasons(presenter), [["webgpu", reason]]) &&
      same(falls, [["webgpu", "webgl2", reason]]),
    JSON.stringify([presenter.backend, falls])
  );
  check(
    `${name} while the pipeline builds: the device is released`,
    world.device.destroyed && world.device.listenerCount() === 0
  );
}

{
  // A throwing onFallback is reported, and the fallback still happens.
  const world = new World({ gpu: false, contexts: [] });
  world.install();
  const reported = [];
  globalThis.reportError = (e) => reported.push(e.message);
  let error = null;
  let calls = 0;
  try {
    await createPresenter(world.canvas, {
      onFallback: () => {
        calls++;
        throw new Error("fake callback error");
      },
    });
  } catch (e) {
    error = e;
  }
  delete globalThis.reportError;
  check(
    "onFallback throwing: every tier is still tried and the rejection names each reason",
    calls === 2 &&
      error !== null &&
      error.message.includes("webgpu: navigator.gpu is missing") &&
      error.message.includes('canvas2d: getContext("2d") answered null'),
    error === null ? "resolved" : error.message
  );
  check(
    "onFallback throwing: the error goes to reportError",
    same(reported, ["fake callback error", "fake callback error"]),
    JSON.stringify(reported)
  );
}

{
  const world = new World({ gpu: false });
  world.install();
  globalThis.reportError = () => undefined;
  const presenter = await createPresenter(world.canvas, {
    onFallback: () => {
      throw new Error("fake callback error");
    },
  });
  delete globalThis.reportError;
  check("onFallback throwing: the next tier builds", presenter.backend === "webgl2", presenter.backend);
}

{
  const world = new World({ gpu: false, contexts: [] });
  world.install();
  let error = null;
  try {
    await createPresenter(world.canvas);
  } catch (e) {
    error = e;
  }
  const message = error === null ? "" : error.message;
  check(
    "every tier refusing rejects, naming each reason",
    message.includes("webgpu: navigator.gpu is missing") &&
      message.includes('webgl2: getContext("webgl2") answered null') &&
      message.includes('canvas2d: getContext("2d") answered null'),
    message
  );
}

// --- prefer --------------------------------------------------------------------

{
  const world = new World();
  const { presenter, falls } = await open(world, "webgl2");
  check(
    "prefer webgl2: WebGPU is never asked",
    presenter.backend === "webgl2" && world.requests.adapter === 0 && falls.length === 0
  );
}
{
  const world = new World();
  const { presenter } = await open(world, "canvas2d");
  check("prefer canvas2d: Canvas 2D", presenter.backend === "canvas2d" && world.requests.adapter === 0);
}
{
  const world = new World().install();
  let error = null;
  try {
    await createPresenter(world.canvas, { prefer: "webgl1" });
  } catch (e) {
    error = e;
  }
  check("prefer: an unknown tier is a RangeError", error instanceof RangeError, String(error));
}

// --- Presenting --------------------------------------------------------------------

/** A 4x2 test pattern: red, green, blue, white over black, grey, a mix and yellow. */
const pattern = Int32Array.of(
  0xff0000,
  0x00ff00,
  0x0000ff,
  0xffffff,
  0x000000,
  0x808080,
  0x123456,
  0xffff00
);

{
  const world = new World();
  const { presenter } = await open(world);
  world.canvas.width = 400;
  world.canvas.height = 300;
  presenter.present(pattern, 4, 2);
  const device = world.device;
  const write = device.writes[0];
  check(
    "webgpu: the words are written as they are, bgra8unorm, 16 bytes a row",
    write.data === pattern &&
      world.textureDescriptor.format === "bgra8unorm" &&
      write.layout.bytesPerRow === 16 &&
      write.size.width === 4 &&
      write.size.height === 2,
    JSON.stringify(write.layout)
  );
  // bgra8unorm reads each texel's bytes as B, G, R, A.
  const gpuBytes = new Uint8Array(write.data.buffer, write.data.byteOffset, 32);
  const gpuTexels = [];
  for (let i = 0; i < 8; i++) {
    gpuTexels.push((gpuBytes[i * 4 + 2] << 16) | (gpuBytes[i * 4 + 1] << 8) | gpuBytes[i * 4]);
  }
  check(
    "webgpu: each texel, read as bgra8unorm, is its word's colour",
    same(gpuTexels, Array.from(pattern)),
    gpuTexels.map((t) => t.toString(16)).join(" ")
  );
  const pass = device.passes[0];
  const viewport = pass.calls.find((c) => c[0] === "setViewport");
  check("webgpu: letterboxed to the framebuffer's aspect", same(viewport, ["setViewport", 0, 50, 400, 200, 0, 1]), JSON.stringify(viewport));
  check(
    "webgpu: one triangle, over a black clear",
    pass.calls.some((c) => c[0] === "draw" && c[1] === 3) &&
      pass.descriptor.colorAttachments[0].loadOp === "clear" &&
      same(pass.descriptor.colorAttachments[0].clearValue, { r: 0, g: 0, b: 0, a: 1 }),
    JSON.stringify(pass.descriptor.colorAttachments[0])
  );
  presenter.present(pattern, 4, 2);
  presenter.present(pattern, 4, 2);
  check(
    "webgpu: no texture or bind group made per frame",
    world.count.createTexture === 1 && world.count.createBindGroup === 1,
    JSON.stringify(world.count)
  );
  check(
    "webgpu: the same descriptors are reused every frame",
    device.writes[1].destination === write.destination &&
      device.writes[2].layout === write.layout &&
      device.passes[2].descriptor === pass.descriptor &&
      device.submits[0] === device.submits[2]
  );
  presenter.present(new Int32Array(6), 3, 2);
  check(
    "webgpu: a new size makes a new texture and destroys the old",
    world.count.createTexture === 2 && device.writes[0].texture.destroyed && device.writes[3].layout.bytesPerRow === 12
  );
}

{
  const world = new World({ gpu: false });
  const { presenter } = await open(world);
  const gl = world.canvas.context;
  world.canvas.width = 400;
  world.canvas.height = 300;
  presenter.present(pattern, 4, 2);
  presenter.present(pattern, 4, 2);
  presenter.present(pattern, 4, 2);
  const uploads = gl.calls.filter((c) => c[0] === "texImage2D" || c[0] === "texSubImage2D");
  check(
    "webgl2: one texImage2D, then texSubImage2D",
    same(
      uploads.map((c) => c[0]),
      ["texImage2D", "texSubImage2D", "texSubImage2D"]
    )
  );
  const first = uploads[0];
  const bytes = first[9];
  check(
    "webgl2: RGBA UNSIGNED_BYTE from the same bytes, never copied",
    first[7] === gl.RGBA &&
      first[8] === gl.UNSIGNED_BYTE &&
      bytes.buffer === pattern.buffer &&
      bytes.length === 32 &&
      uploads[2][9] === bytes
  );
  // An RGBA texel sampled with `.bgr` gives (b, g, r) as the red, green and blue out.
  const glTexels = [];
  for (let i = 0; i < 8; i++) {
    const [r, g, b] = [bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]];
    glTexels.push((b << 16) | (g << 8) | r);
  }
  check(
    "webgl2: each texel, sampled as .bgr, is its word's colour",
    same(glTexels, Array.from(pattern)),
    glTexels.map((t) => t.toString(16)).join(" ")
  );
  const copy = Int32Array.from(pattern);
  presenter.present(copy, 4, 2);
  const again = gl.calls[gl.calls.length - 1];
  const sized = gl.calls.filter((c) => c[0] === "texSubImage2D").pop();
  check(
    "webgl2: a new buffer at the same size gets a new view of its own bytes",
    sized[9] !== bytes && sized[9].buffer === copy.buffer && again[0] === "drawArrays",
    JSON.stringify(sized.slice(0, 9))
  );
  presenter.present(new Int32Array(6), 3, 2);
  const resized = gl.calls.filter((c) => c[0] === "texImage2D");
  check(
    "webgl2: a new size uploads with texImage2D again",
    resized.length === 2 && resized[1][4] === 3 && resized[1][5] === 2 && resized[1][9].length === 24,
    JSON.stringify(resized.map((c) => c.slice(4, 6)))
  );
  check("webgl2: the fragment shader is highp", gl.sources.some((s) => s.includes("precision highp float;")));
  check(
    "webgl2: the fragment shader swizzles .bgr and forces alpha to 1",
    gl.sources.some((s) => s.includes("texture(frame, uv).bgr, 1.0"))
  );
  check(
    "webgl2: NEAREST filtering",
    gl.params.some((p) => p[0] === gl.TEXTURE_MIN_FILTER && p[1] === gl.NEAREST) &&
      gl.params.some((p) => p[0] === gl.TEXTURE_MAG_FILTER && p[1] === gl.NEAREST)
  );
  const viewports = gl.calls.filter((c) => c[0] === "viewport");
  check("webgl2: letterboxed to the framebuffer's aspect", same(viewports[1], ["viewport", 0, 50, 400, 200]), JSON.stringify(viewports));
  const drawn = gl.calls.length;
  presenter.destroy();
  presenter.present(pattern, 4, 2);
  check(
    "webgl2: destroy deletes the texture and program, loses the context and draws nothing after",
    world.count.glDeleted === 1 &&
      world.count.glProgramsDeleted === 1 &&
      world.count.glContextsLost === 1 &&
      (world.canvas.listeners.get("webglcontextlost") || []).length === 0 &&
      gl.calls.length === drawn,
    JSON.stringify(world.count)
  );
}

{
  const world = new World({ contexts: ["2d"] });
  const { presenter } = await open(world);
  const ctx = world.current.context;
  world.current.width = 400;
  world.current.height = 300;
  presenter.present(pattern, 4, 2);
  check(
    "canvas2d: the swizzle produces RGBA, opaque",
    same(
      ctx.calls.length > 0 && world.canvases.find((c) => c.offscreen).context.lastPut,
      [
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 0x12, 0x34,
        0x56, 255, 255, 255, 0, 255,
      ]
    ),
    JSON.stringify(world.canvases.find((c) => c.offscreen).context.lastPut)
  );
  const draw = ctx.calls.find((c) => c[0] === "drawImage");
  check(
    "canvas2d: drawn letterboxed with smoothing off",
    same(draw.slice(2), [0, 50, 400, 200, false]),
    JSON.stringify(draw.slice(2))
  );
  presenter.present(pattern, 4, 2);
  presenter.present(pattern, 4, 2);
  const source = world.canvases.find((c) => c.offscreen).context;
  const puts = source.calls.filter((c) => c[0] === "putImageData");
  check(
    "canvas2d: one ImageData, reused every frame",
    world.count.createImageData === 1 && puts[0][1] === puts[2][1],
    JSON.stringify(world.count)
  );
  presenter.present(Int32Array.of(0x00ff00 | (0x7f << 24)), 1, 1);
  check("canvas2d: the top byte is ignored", same(source.lastPut, [0, 255, 0, 255]), JSON.stringify(source.lastPut));
  const drawn = ctx.calls.length;
  presenter.destroy();
  presenter.present(pattern, 4, 2);
  check("canvas2d: destroy, then present draws nothing", ctx.calls.length === drawn);
}

{
  const world = new World();
  const { presenter } = await open(world);
  const thrown = (f) => {
    try {
      f();
      return null;
    } catch (e) {
      return e;
    }
  };
  check("present: a 0-wide framebuffer is a RangeError", thrown(() => presenter.present(pattern, 0, 2)) instanceof RangeError);
  check(
    "present: too few words is a RangeError",
    thrown(() => presenter.present(pattern, 4, 3)) instanceof RangeError
  );
  presenter.resize(200, 100, 2);
  check("resize: the drawing buffer is the CSS size in device pixels", world.canvas.width === 400 && world.canvas.height === 200);
  const refused = [
    [Number.NaN, 100, 1],
    [200, Number.POSITIVE_INFINITY, 1],
    [-1, 100, 1],
    [200, 100, 0],
    [200, 100, -2],
    [200, 100, Number.NaN],
  ].filter(([w, h, dpr]) => thrown(() => presenter.resize(w, h, dpr)) instanceof RangeError);
  check(
    "resize: a size that is not finite or below 0, or a ratio not above 0, is a RangeError",
    refused.length === 6 && world.canvas.width === 400 && world.canvas.height === 200,
    String(refused.length)
  );
}

// --- Runtime loss ---------------------------------------------------------------

{
  const world = new World();
  const { presenter, falls } = await open(world);
  presenter.resize(160, 90, 1);
  const device = world.device;
  device.loseNow("unknown", "fake loss");
  await settle();
  check("device.lost: falls to WebGL 2", presenter.backend === "webgl2", presenter.backend);
  check(
    "device.lost: onFallback is called with the reason",
    same(falls, [["webgpu", "webgl2", "WebGPU device lost (unknown): fake loss"]]),
    JSON.stringify(falls)
  );
  check(
    "device.lost: recorded in attempts",
    same(reasons(presenter), [["webgpu", "WebGPU device lost (unknown): fake loss"]])
  );
  check(
    "device.lost: the fresh canvas is in the page, at the presenter's size",
    presenter.canvas === world.current &&
      world.current !== world.canvas &&
      world.current.width === 160 &&
      world.current.height === 90
  );
  check("device.lost: the old device is released", device.destroyed && device.listenerCount() === 0);
  presenter.present(pattern, 4, 2);
  check(
    "device.lost: the next frame goes to WebGL 2",
    world.current.context.calls.some((c) => c[0] === "texImage2D")
  );
}

{
  const world = new World().install();
  let seen = null;
  let presenter = null;
  presenter = await createPresenter(world.canvas, {
    onFallback: () => {
      seen = presenter.canvas;
    },
  });
  world.device.raise("fake validation error");
  check(
    "onFallback: presenter.canvas is already the fresh canvas",
    seen !== null && seen === world.current && seen !== world.canvas
  );
}

{
  const world = new World();
  const { presenter, falls } = await open(world);
  world.device.raise("fake validation error");
  check(
    "uncapturederror: falls to WebGL 2 with the reason",
    presenter.backend === "webgl2" && falls[0][2] === "uncaptured WebGPU error: fake validation error",
    JSON.stringify(falls)
  );
}

{
  const world = new World({ gpu: false });
  const { presenter, falls } = await open(world);
  const glCanvas = world.current;
  let prevented = false;
  glCanvas.context.lost = true;
  glCanvas.dispatch("webglcontextlost", {
    preventDefault: () => {
      prevented = true;
    },
  });
  check("webglcontextlost: preventDefault is called", prevented);
  check(
    "webglcontextlost: falls to Canvas 2D on a fresh canvas",
    presenter.backend === "canvas2d" && world.current !== glCanvas && presenter.canvas === world.current,
    presenter.backend
  );
  check(
    "webglcontextlost: onFallback is called",
    same(falls[falls.length - 1], ["webgl2", "canvas2d", "the WebGL 2 context was lost"]),
    JSON.stringify(falls)
  );
  check("webglcontextlost: the listener is removed", (glCanvas.listeners.get("webglcontextlost") || []).length === 0);
}

{
  const world = new World({ gpu: false, contexts: ["webgl2"] });
  const { presenter } = await open(world);
  const gl = world.current.context;
  world.current.dispatch("webglcontextlost", { preventDefault: () => undefined });
  check(
    "every tier lost at runtime: present draws nothing and attempts say why",
    presenter.backend === "canvas2d" &&
      presenter.attempts.length === 3 &&
      presenter.attempts[2].reason === 'getContext("2d") answered null'
  );
  const glCalls = gl.calls.length;
  let threw = false;
  try {
    presenter.present(pattern, 4, 2);
  } catch {
    threw = true;
  }
  check("every tier lost at runtime: present does not throw", !threw);
  check(
    "every tier lost at runtime: present draws nothing",
    gl.calls.length === glCalls && world.canvases.every((c) => c.mode !== "2d"),
    JSON.stringify(gl.calls.slice(glCalls))
  );
}

{
  const world = new World();
  const { presenter, falls } = await open(world);
  presenter.destroy();
  await settle();
  check(
    "destroy: releases the device, and its own loss is not a fallback",
    world.device.destroyed && falls.length === 0 && presenter.backend === "webgpu"
  );
  presenter.present(pattern, 4, 2);
  check("destroy: present then draws nothing", world.device.writes.length === 0);
}

{
  // Destroyed from inside a runtime onFallback: the tier that builds after
  // it is given back, not installed.
  const world = new World().install();
  let presenter = null;
  presenter = await createPresenter(world.canvas, {
    onFallback: () => {
      presenter.destroy();
    },
  });
  world.device.raise("fake validation error");
  const glCanvas = world.current;
  presenter.present(pattern, 4, 2);
  check(
    "destroy inside onFallback: the next tier is released and nothing draws",
    glCanvas.mode === "webgl2" &&
      world.count.glContextsLost === 1 &&
      world.count.glProgramsDeleted === 1 &&
      (glCanvas.listeners.get("webglcontextlost") || []).length === 0 &&
      glCanvas.context.calls.every((c) => c[0] !== "texImage2D"),
    JSON.stringify(world.count)
  );
}

{
  // A release that throws is reported, and the fallback goes on.
  const world = new World({ gpu: false, glDeleteThrows: true });
  const { presenter, falls } = await open(world);
  const reported = [];
  globalThis.reportError = (e) => reported.push(e.message);
  world.current.dispatch("webglcontextlost", { preventDefault: () => undefined });
  delete globalThis.reportError;
  check(
    "a release that throws: reported, and the fallback still happens",
    presenter.backend === "canvas2d" && falls.length === 2 && same(reported, ["fake deleteTexture error"]),
    JSON.stringify(reported)
  );
}

// --- The loop --------------------------------------------------------------------

/** Runs a loop on a scripted clock and answers what it did at each frame time. */
const loop = (settings, times) => {
  const clock = installClock();
  const frames = [];
  let steps = 0;
  const running = runFixedStep({
    ...settings,
    step: () => {
      steps++;
    },
    render: (alpha, frameMs) => {
      frames.push({ steps, alpha, frameMs });
    },
  });
  for (const t of times) {
    clock.tick(t);
  }
  return { frames, running, clock };
};

{
  const { frames } = loop({ stepsPerSecond: 100 }, [1000, 1015, 1030, 1040]);
  check(
    "loop: the first frame renders with alpha 0 and no step",
    same(frames[0], { steps: 0, alpha: 0, frameMs: 0 }),
    JSON.stringify(frames[0])
  );
  check(
    "loop: steps follow the accumulated time, alpha the remainder",
    same(
      frames.map((f) => [f.steps, f.alpha, f.frameMs]),
      [
        [0, 0, 0],
        [1, 0.5, 15],
        [3, 0, 15],
        [4, 0, 10],
      ]
    ),
    JSON.stringify(frames)
  );
}

{
  // Three frames between steps: a 240 Hz display rendering a 60 Hz program.
  const times = [];
  for (let i = 0; i <= 8; i++) {
    times.push(i * (1000 / 240));
  }
  const { frames } = loop({ stepsPerSecond: 60 }, times);
  check("loop: renders on every animation frame, faster than it steps", frames.length === 9 && frames[8].steps === 2, JSON.stringify(frames));
}

{
  const { frames } = loop({ stepsPerSecond: 100 }, [1000, 990, 1000]);
  check(
    "loop: a clock that runs backwards is a frame of 0 ms, with no step",
    same(
      frames.map((f) => [f.steps, f.frameMs]),
      [
        [0, 0],
        [0, 0],
        [1, 10],
      ]
    ),
    JSON.stringify(frames)
  );
}

{
  const { frames } = loop({ stepsPerSecond: 100, maxStepsPerFrame: 100 }, [0, 5000]);
  check(
    "loop: a long frame is clamped to 250 ms",
    frames[1].steps === 25 && frames[1].frameMs === 250,
    JSON.stringify(frames[1])
  );
}

{
  const { frames } = loop({ stepsPerSecond: 100 }, [0, 105, 115]);
  check(
    "loop: maxStepsPerFrame caps the steps and drops the backlog",
    frames[1].steps === 8 && frames[1].alpha === 0.5 && frames[2].steps === 9 && frames[2].alpha === 0.5,
    JSON.stringify(frames)
  );
}

{
  // Frame times land on vsync, so jitter is a missed frame (every fifth here)
  // or, rarely, one early timestamp.
  const times = [];
  for (let i = 0; i <= 300; i++) {
    if (i % 5 !== 4) {
      times.push(i * (1000 / 240) - (i === 290 ? 3 : 0));
    }
  }
  const { running } = loop({ stepsPerSecond: 60 }, times);
  check(
    "loop: refreshHz reads the display's rate from the fast intervals",
    Math.abs(running.refreshHz - 240) < 1,
    String(running.refreshHz)
  );
  check("loop: fps counts the renders a second", Math.abs(running.fps - 192) < 5, String(running.fps));
}

{
  const { running, clock } = loop({ stepsPerSecond: 60 }, []);
  check("loop: refreshHz and fps are 0 before a frame", running.refreshHz === 0 && running.fps === 0);
  clock.tick(0);
  const handle = clock.handle;
  running.stop();
  check("loop: stop cancels the pending frame", same(clock.cancelled, [handle]) && clock.pending === null);
}

{
  const clock = installClock();
  let renders = 0;
  const running = runFixedStep({ stepsPerSecond: 60, step: () => undefined, render: () => renders++ });
  const pending = clock.pending;
  running.stop();
  pending(16);
  check("loop: a frame already running when stopped renders nothing", renders === 0 && clock.requested === 1);
}

{
  const clock = installClock();
  let steps = 0;
  let renders = 0;
  let running = null;
  running = runFixedStep({
    stepsPerSecond: 100,
    step: () => {
      steps++;
      running.stop();
    },
    render: () => renders++,
  });
  clock.tick(0);
  clock.tick(50);
  check(
    "loop: a step that stops the loop ends the frame: no more steps, no render",
    steps === 1 && renders === 1 && clock.pending === null,
    JSON.stringify({ steps, renders })
  );
}

{
  installClock();
  const thrown = (settings) => {
    try {
      runFixedStep({ step: () => undefined, render: () => undefined, ...settings });
      return null;
    } catch (e) {
      return e;
    }
  };
  check(
    "loop: stepsPerSecond and maxStepsPerFrame are checked",
    thrown({ stepsPerSecond: 0 }) instanceof RangeError &&
      thrown({ stepsPerSecond: 60, maxStepsPerFrame: 0 }) instanceof RangeError &&
      thrown({ stepsPerSecond: 60, maxStepsPerFrame: 1.5 }) instanceof RangeError
  );
}

results.push(`checks: ${results.length}`);
console.log(results.join("\n"));
