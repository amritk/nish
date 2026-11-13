// nish/page/frame: puts a framebuffer a wasm module draws into on a canvas,
// and drives the module with a fixed-step loop that renders on every
// animation frame. The framebuffer is the module's own memory: an Int32Array
// of 0xRRGGBB words, row-major, the shape `std/term-pixels.ts` draws. Plain
// ECMAScript with no imports, so a browser loads it as it is.
//
// Both halves read their browser objects (`navigator`, `requestAnimationFrame`,
// `performance`) from `globalThis` when they are called, never when the module
// loads, so tests/page-frame runs them under Node against fakes.

/** The tiers, best first. A fallback only ever moves down this list. */
const TIERS = ["webgpu", "webgl2", "canvas2d"];

// The WebGPU flag values are fixed by the specification; spelling them here
// rather than reading `GPUTextureUsage` keeps the module free of a global that
// exists only where WebGPU does.
const TEXTURE_BINDING = 0x04;
const COPY_DST = 0x02;

/**
 * One full-screen triangle, its texture coordinates running 0..1 across the
 * viewport with row 0 at the top. The viewport is the letterbox, so the
 * shader never sees the canvas size. The texture is `bgra8unorm`, so a
 * little-endian 0x00RRGGBB word samples as the colour it names; the alpha
 * byte is 0 and is replaced by 1.
 */
const WGSL = `
struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> Out {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out: Out;
  out.position = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}

@group(0) @binding(0) var frame: texture_2d<f32>;
@group(0) @binding(1) var nearest: sampler;

@fragment fn fs(in: Out) -> @location(0) vec4f {
  return vec4f(textureSample(frame, nearest, in.uv).rgb, 1.0);
}
`;

/** The same triangle for WebGL 2, from `gl_VertexID` alone: no buffer is bound. */
const GLSL_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  uv = vec2(p.x, 1.0 - p.y);
}
`;

/**
 * The bytes are uploaded as RGBA, so a 0x00RRGGBB word arrives as
 * (BB, GG, RR, 00): `.bgr` puts the channels back, and alpha is forced to 1.
 */
const GLSL_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D frame;
in vec2 uv;
out vec4 color;
void main() {
  color = vec4(texture(frame, uv).bgr, 1.0);
}
`;

/** A tier's refusal: the message is the reason `attempts` records. */
const refuse = (reason) => {
  throw new Error(reason);
};

/** The message of anything a browser API threw or rejected with. */
const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/**
 * Writes into `box` the largest rectangle of the framebuffer's aspect that
 * fits the canvas, centred, in whole device pixels. `box` is the caller's and
 * reused, so a frame allocates nothing for it.
 */
const letterbox = (box, canvasWidth, canvasHeight, width, height) => {
  const scale = Math.min(canvasWidth / width, canvasHeight / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  box.x = Math.floor((canvasWidth - w) / 2);
  box.y = Math.floor((canvasHeight - h) / 2);
  box.w = w;
  box.h = h;
};

/**
 * The WebGPU tier. Each step that can refuse is a recorded reason: no
 * `navigator.gpu`, no adapter, a device that will not come, a canvas that
 * will not give a "webgpu" context, a pipeline that will not build. The
 * context is asked for after the device, so a refusal before it leaves the
 * canvas free for the next tier.
 */
const buildWebGpu = async (state) => {
  const nav = globalThis.navigator;
  const gpu = nav === undefined || nav === null ? undefined : nav.gpu;
  if (gpu === undefined || gpu === null) {
    refuse("navigator.gpu is missing");
  }
  let adapter = null;
  try {
    adapter = await gpu.requestAdapter();
  } catch (error) {
    refuse(`requestAdapter rejected: ${messageOf(error)}`);
  }
  if (adapter === null || adapter === undefined) {
    refuse("requestAdapter answered null");
  }
  let device = null;
  try {
    device = await adapter.requestDevice();
  } catch (error) {
    refuse(`requestDevice rejected: ${messageOf(error)}`);
  }
  // A lost device or an error nothing captured ends the tier. Both are
  // listened for from the moment the device exists: until the presenter has
  // taken the tier, the first is kept in `ended` and the presenter reads it
  // (`tier.ended`) before it does; after, the presenter drops the tier for the
  // next one. A loss this tier caused itself (`release`, or a refusal below)
  // arrives once the presenter has moved on, and `lose` ignores a tier that
  // is no longer current.
  let ended = null;
  let tier = null;
  const end = (reason) => {
    if (ended === null) {
      ended = reason;
    }
    if (tier !== null) {
      state.lose(tier, reason);
    }
  };
  const onError = (event) => {
    end(`uncaptured WebGPU error: ${messageOf(event.error)}`);
  };
  device.addEventListener("uncapturederror", onError);
  device.lost.then((info) => {
    end(`WebGPU device lost (${info.reason}): ${info.message}`);
  });
  const drop = () => {
    device.removeEventListener("uncapturederror", onError);
    device.destroy();
  };
  const context = state.canvas.getContext("webgpu");
  if (context === null) {
    drop();
    refuse('getContext("webgpu") answered null');
  }
  state.touched = true;
  const format = gpu.getPreferredCanvasFormat();
  let pipeline = null;
  try {
    context.configure({ device, format, alphaMode: "opaque" });
    const module = device.createShaderModule({ code: WGSL });
    pipeline = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
  } catch (error) {
    drop();
    refuse(`the WebGPU pipeline did not build: ${messageOf(error)}`);
  }
  const sampler = device.createSampler({ magFilter: "nearest", minFilter: "nearest" });

  // Everything a frame passes to the API is made here, or when the
  // framebuffer's size changes, and only its fields are written per frame.
  let texture = null;
  let group = null;
  const destination = { texture: null };
  const dataLayout = { offset: 0, bytesPerRow: 0, rowsPerImage: 0 };
  const size = { width: 0, height: 0 };
  const textureDescriptor = { size, format: "bgra8unorm", usage: TEXTURE_BINDING | COPY_DST };
  const groupEntries = [
    { binding: 0, resource: null },
    { binding: 1, resource: sampler },
  ];
  const groupDescriptor = { layout: pipeline.getBindGroupLayout(0), entries: groupEntries };
  const attachment = { view: null, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" };
  const pass = { colorAttachments: [attachment] };
  const submitted = [null];
  const box = { x: 0, y: 0, w: 0, h: 0 };

  tier = {
    backend: "webgpu",
    ended: () => ended,
    present: (pixels, width, height) => {
      if (width !== size.width || height !== size.height) {
        if (texture !== null) {
          texture.destroy();
        }
        size.width = width;
        size.height = height;
        texture = device.createTexture(textureDescriptor);
        destination.texture = texture;
        dataLayout.bytesPerRow = width * 4;
        dataLayout.rowsPerImage = height;
        groupEntries[0].resource = texture.createView();
        group = device.createBindGroup(groupDescriptor);
      }
      device.queue.writeTexture(destination, pixels, dataLayout, size);
      attachment.view = context.getCurrentTexture().createView();
      letterbox(box, state.canvas.width, state.canvas.height, width, height);
      const encoder = device.createCommandEncoder();
      const render = encoder.beginRenderPass(pass);
      render.setPipeline(pipeline);
      render.setBindGroup(0, group);
      render.setViewport(box.x, box.y, box.w, box.h, 0, 1);
      render.draw(3);
      render.end();
      submitted[0] = encoder.finish();
      device.queue.submit(submitted);
    },
    release: () => {
      device.removeEventListener("uncapturederror", onError);
      if (texture !== null) {
        texture.destroy();
      }
      context.unconfigure();
      device.destroy();
    },
  };
  return tier;
};

/** The WebGL 2 tier: a texture upload of the same bytes and the same triangle. */
const buildWebGl2 = (state) => {
  const canvas = state.canvas;
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
  });
  if (gl === null) {
    refuse('getContext("webgl2") answered null');
  }
  state.touched = true;
  if (gl.isContextLost()) {
    refuse("the WebGL 2 context was lost before it was used");
  }
  const compile = (kind, source) => {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      refuse(`a WebGL 2 shader did not compile: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, GLSL_VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, GLSL_FRAGMENT));
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    refuse(`the WebGL 2 program did not link: ${gl.getProgramInfoLog(program)}`);
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "frame"), 0);
  gl.clearColor(0, 0, 0, 1);

  // `texSubImage2D` wants a Uint8Array for UNSIGNED_BYTE, so the Int32Array is
  // viewed as bytes. The view is made again only when the caller's array
  // moves: a new buffer after `memory.grow`, or a different span of it.
  let bytes = null;
  let width = 0;
  let height = 0;
  const box = { x: 0, y: 0, w: 0, h: 0 };
  const tier = {
    backend: "webgl2",
    present: (pixels, w, h) => {
      const length = w * h * 4;
      if (
        bytes === null ||
        bytes.buffer !== pixels.buffer ||
        bytes.byteOffset !== pixels.byteOffset ||
        bytes.length !== length
      ) {
        bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, length);
      }
      if (w !== width || h !== height) {
        width = w;
        height = h;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      }
      letterbox(box, gl.drawingBufferWidth, gl.drawingBufferHeight, w, h);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(box.x, box.y, box.w, box.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    release: () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      if (!gl.isContextLost()) {
        gl.deleteTexture(texture);
        gl.deleteProgram(program);
      }
    },
  };
  // `preventDefault` tells the browser the page handles the loss; the
  // presenter does, by moving to the next tier rather than waiting for a
  // restore that may never come.
  const onLost = (event) => {
    event.preventDefault();
    state.lose(tier, "the WebGL 2 context was lost");
  };
  canvas.addEventListener("webglcontextlost", onLost);
  return tier;
};

/**
 * The Canvas 2D tier, which needs no GPU: the words are swizzled into an
 * ImageData on a canvas the framebuffer's size, which is then drawn scaled
 * with smoothing off. The ImageData and its word view are kept until the
 * framebuffer's size changes.
 */
const buildCanvas2d = (state) => {
  const canvas = state.canvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (ctx === null) {
    refuse('getContext("2d") answered null');
  }
  state.touched = true;
  const source = canvas.ownerDocument.createElement("canvas");
  const sourceCtx = source.getContext("2d");
  if (sourceCtx === null) {
    refuse('the framebuffer-sized canvas answered null to getContext("2d")');
  }
  let image = null;
  let words = null;
  const box = { x: 0, y: 0, w: 0, h: 0 };
  return {
    backend: "canvas2d",
    present: (pixels, width, height) => {
      if (image === null || image.width !== width || image.height !== height) {
        source.width = width;
        source.height = height;
        image = sourceCtx.createImageData(width, height);
        words = new Uint32Array(image.data.buffer, image.data.byteOffset, width * height);
      }
      // ImageData is R, G, B, A in memory, which is the little-endian word
      // 0xAABBGGRR: swap the red and blue bytes and make it opaque.
      const n = width * height;
      for (let i = 0; i < n; i++) {
        const p = pixels[i];
        words[i] = 0xff000000 | ((p & 0xff) << 16) | (p & 0xff00) | ((p >> 16) & 0xff);
      }
      sourceCtx.putImageData(image, 0, 0);
      letterbox(box, canvas.width, canvas.height, width, height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Resizing a canvas resets its context's state, so this is set every frame.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, box.x, box.y, box.w, box.h);
    },
    release: () => undefined,
  };
};

const BUILDERS = { webgpu: buildWebGpu, webgl2: buildWebGl2, canvas2d: buildCanvas2d };

/**
 * Makes a presenter on `canvas`, trying WebGPU, then WebGL 2, then Canvas 2D,
 * and keeping the first that builds. Each tier that refuses is recorded in
 * `attempts` with its reason and reported to `onFallback`.
 *
 * A canvas keeps the first context type it was given, so once a tier has taken
 * a context and is then refused or lost, the next tier is built on a fresh
 * canvas: `canvas.cloneNode(false)`, put in the old one's place in the
 * document. The clone keeps the element's attributes (id, classes, style,
 * size) but not its event listeners; read `presenter.canvas` after a
 * fallback to rebind them.
 *
 * @param canvas - the canvas to present on
 * @param options - `prefer`, the tier to start from (the tiers above it are
 *   not tried), and `onFallback`, called each time a tier is given up for the
 *   next one, at creation or later on a lost device or context
 * @returns the presenter, once a tier has built; it rejects, naming every
 *   tier's reason, when none does
 */
export const createPresenter = async (canvas, options) => {
  const prefer = options === undefined || options.prefer === undefined ? "webgpu" : options.prefer;
  const onFallback = options === undefined ? undefined : options.onFallback;
  const first = TIERS.indexOf(prefer);
  if (first < 0) {
    throw new RangeError(`nish/page/frame: prefer is one of ${TIERS.join(", ")}, not ${prefer}`);
  }
  const attempts = [];
  let current = null;
  // The tier presenting now, or the last one tried once every tier is gone.
  let shown = prefer;
  let destroyed = false;
  let cssSize = null;

  const state = {
    canvas,
    // Whether the canvas has handed out a context: the next tier then needs a fresh one.
    touched: false,
    lose: (tier, reason) => {
      if (tier !== current || destroyed) {
        return;
      }
      current = null;
      attempts.push({ backend: tier.backend, reason });
      tier.release();
      // Every tier below WebGPU builds synchronously, so a fallback is over
      // before the next frame is presented.
      buildFrom(TIERS.indexOf(tier.backend) + 1, tier.backend, reason);
    },
  };

  const freshCanvas = () => {
    const fresh = state.canvas.cloneNode(false);
    state.canvas.replaceWith(fresh);
    state.canvas = fresh;
    state.touched = false;
    if (cssSize !== null) {
      fresh.width = cssSize.width;
      fresh.height = cssSize.height;
    }
  };

  // A callback that throws is reported, not let through: the fallback it
  // was told about still has to happen.
  const fellBack = (from, to, reason) => {
    if (onFallback === undefined) {
      return;
    }
    try {
      onFallback(from, to, reason);
    } catch (error) {
      if (typeof globalThis.reportError === "function") {
        globalThis.reportError(error);
      } else {
        console.error(error);
      }
    }
  };

  // Builds the first tier from `at` down that will, calling `onFallback`
  // for the hand-over from `from` and for each refusal after it. Answers
  // either the tier or a promise of it: WebGPU is the only asynchronous one.
  const buildFrom = (at, from, reason) => {
    if (at >= TIERS.length) {
      return null;
    }
    // The fresh canvas goes in first, so `onFallback` can reach it through
    // `presenter.canvas` to add its listeners again.
    if (state.touched) {
      freshCanvas();
    }
    if (from !== null) {
      fellBack(from, TIERS[at], reason);
    }
    const backend = TIERS[at];
    const accept = (tier) => {
      // A device lost or erring while its pipeline built (or in the moment
      // before this ran) has already ended the tier.
      const ended = tier.ended === undefined ? null : tier.ended();
      if (ended !== null) {
        tier.release();
        return decline(new Error(ended));
      }
      current = tier;
      shown = backend;
      return tier;
    };
    const decline = (error) => {
      const why = messageOf(error);
      shown = backend;
      attempts.push({ backend, reason: why });
      return buildFrom(at + 1, backend, why);
    };
    try {
      const built = BUILDERS[backend](state);
      return built instanceof Promise ? built.then(accept, decline) : accept(built);
    } catch (error) {
      return decline(error);
    }
  };

  await buildFrom(first, null, "");
  if (current === null) {
    throw new Error(
      `nish/page/frame: no backend could present: ${attempts.map((a) => `${a.backend}: ${a.reason}`).join("; ")}`
    );
  }

  return {
    get backend() {
      return shown;
    },
    get attempts() {
      return attempts;
    },
    get canvas() {
      return state.canvas;
    },
    present(pixels, width, height) {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new RangeError(`nish/page/frame: a framebuffer is at least 1x1 whole pixels, not ${width}x${height}`);
      }
      if (pixels.length < width * height) {
        throw new RangeError(`nish/page/frame: ${width}x${height} pixels need ${width * height} words, not ${pixels.length}`);
      }
      if (current !== null) {
        current.present(pixels, width, height);
      }
    },
    resize(cssWidth, cssHeight, devicePixelRatio) {
      const width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
      const height = Math.max(1, Math.round(cssHeight * devicePixelRatio));
      cssSize = { width, height };
      if (state.canvas.width !== width) {
        state.canvas.width = width;
      }
      if (state.canvas.height !== height) {
        state.canvas.height = height;
      }
    },
    destroy() {
      if (current !== null && !destroyed) {
        destroyed = true;
        current.release();
        current = null;
      }
      destroyed = true;
    },
  };
};

/** How many recent frame intervals the refresh-rate estimate reads. */
const INTERVALS = 64;
/** The longest frame the loop accounts for, in milliseconds: a hidden tab's gap is cut to this. */
const LONGEST_FRAME_MS = 250;
/** How often the frame-rate counter is brought up to date, in milliseconds. */
const FPS_WINDOW_MS = 500;

/**
 * Runs `step` at a fixed `stepsPerSecond` and `render` on every animation
 * frame, at whatever rate the display runs: a 240 Hz display gets 240 renders
 * a second, each with the `alpha` between the last step and the next to
 * interpolate with. A frame longer than a quarter second (a hidden tab, a
 * debugger pause) is counted as a quarter second, and at most
 * `maxStepsPerFrame` steps run per frame; the backlog past that is dropped
 * rather than carried, so a slow machine slows the game down instead of
 * falling ever further behind. A `step` or `render` that throws ends the
 * loop.
 *
 * @param options - `stepsPerSecond`, `maxStepsPerFrame` (8 by default), and
 *   the `step` and `render` callbacks; `render` gets the alpha in [0, 1) and
 *   the frame's length in milliseconds, after the clamp (0 on the first frame)
 * @returns the running loop: `stop()` cancels its next frame, `refreshHz` is
 *   the display's rate as read from the fastest recent frame intervals (0
 *   until a frame has passed), and `fps` the renders per second over the last
 *   half second or so (0 until one has passed)
 */
export const runFixedStep = (options) => {
  const stepsPerSecond = options.stepsPerSecond;
  if (!(stepsPerSecond > 0) || !Number.isFinite(stepsPerSecond)) {
    throw new RangeError(`nish/page/frame: stepsPerSecond is a positive number, not ${stepsPerSecond}`);
  }
  const maxSteps = options.maxStepsPerFrame === undefined ? 8 : options.maxStepsPerFrame;
  if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    throw new RangeError(`nish/page/frame: maxStepsPerFrame is a whole number of at least 1, not ${maxSteps}`);
  }
  const step = options.step;
  const render = options.render;
  const interval = 1000 / stepsPerSecond;
  const requestFrame = globalThis.requestAnimationFrame;
  const cancelFrame = globalThis.cancelAnimationFrame;

  const intervals = new Float64Array(INTERVALS);
  const sorted = new Float64Array(INTERVALS);
  let recorded = 0;
  let last = -1;
  let accumulator = 0;
  let handle = 0;
  let stopped = false;
  let windowStart = -1;
  let windowFrames = 0;
  let fps = 0;

  const frame = (now) => {
    if (stopped) {
      return;
    }
    let frameMs = 0;
    if (last >= 0) {
      const elapsed = now - last;
      if (elapsed > 0) {
        intervals[recorded % INTERVALS] = elapsed;
        recorded++;
      }
      frameMs = elapsed > LONGEST_FRAME_MS ? LONGEST_FRAME_MS : elapsed;
      accumulator += frameMs;
      let steps = 0;
      while (!stopped && accumulator >= interval && steps < maxSteps) {
        step();
        accumulator -= interval;
        steps++;
      }
      if (accumulator >= interval) {
        accumulator %= interval;
      }
    }
    last = now;
    // A step may have stopped the loop: the frame then renders nothing.
    if (stopped) {
      return;
    }
    if (windowStart < 0) {
      windowStart = now;
    } else {
      windowFrames++;
      if (now - windowStart >= FPS_WINDOW_MS) {
        fps = (windowFrames * 1000) / (now - windowStart);
        windowStart = now;
        windowFrames = 0;
      }
    }
    render(accumulator / interval, frameMs);
    if (!stopped) {
      handle = requestFrame(frame);
    }
  };
  handle = requestFrame(frame);

  return {
    stop() {
      stopped = true;
      cancelFrame(handle);
    },
    get refreshHz() {
      const n = recorded < INTERVALS ? recorded : INTERVALS;
      if (n === 0) {
        return 0;
      }
      // The eighth-fastest of the last 64 intervals: animation frames land on
      // the display's refresh, so the fast ones are its period, and taking
      // one an eighth of the way in rather than the fastest steps over a
      // single early frame that jitter brought in short.
      sorted.set(intervals);
      const kept = sorted.subarray(0, n);
      kept.sort();
      return 1000 / kept[Math.floor(n / 8)];
    },
    get fps() {
      return fps;
    },
  };
};
