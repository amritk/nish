// Stand-ins for the browser objects runtime/page-frame.mjs talks to: a
// document and canvas, a WebGPU adapter and device, a WebGL 2 context, a
// Canvas 2D context and the animation-frame clock. Each records what it was
// asked to do, so tests/page-frame/check.mjs can read the calls back; each
// refusal the presenter must handle is a switch on the `World` that made it.

/** A canvas keeps the first context type it hands out; any other then answers null, as the HTML standard has it. */
class FakeCanvas {
  constructor(world, attributes) {
    this.world = world;
    this.attributes = { ...attributes };
    this.width = 300;
    this.height = 150;
    this.mode = null;
    this.context = null;
    this.listeners = new Map();
    this.parent = null;
    this.ownerDocument = world.document;
    world.canvases.push(this);
  }

  getContext(type, options) {
    if (this.mode !== null) {
      return this.mode === type ? this.context : null;
    }
    const context = this.world.makeContext(this, type, options);
    if (context !== null) {
      this.mode = type;
      this.context = context;
    }
    return context;
  }

  cloneNode(deep) {
    if (deep !== false) {
      throw new Error("the presenter clones a canvas shallowly");
    }
    const copy = new FakeCanvas(this.world, this.attributes);
    copy.width = this.width;
    copy.height = this.height;
    return copy;
  }

  replaceWith(node) {
    const parent = this.parent;
    // A node with no parent ignores replaceWith, as the DOM standard has it.
    if (parent === null) {
      return;
    }
    parent.children[parent.children.indexOf(this)] = node;
    node.parent = parent;
    this.parent = null;
  }

  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      list.filter((l) => l !== listener)
    );
  }

  dispatch(type, event) {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }
}

class FakeImageData {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

const make2d = (world, canvas) => {
  const ctx = {
    canvas,
    fillStyle: "",
    imageSmoothingEnabled: true,
    calls: [],
    createImageData: (w, h) => {
      world.count.createImageData++;
      return new FakeImageData(w, h);
    },
    putImageData: (image, x, y) => {
      ctx.calls.push(["putImageData", image, x, y]);
      ctx.lastPut = Array.from(image.data);
    },
    fillRect: (x, y, w, h) => {
      ctx.calls.push(["fillRect", x, y, w, h]);
    },
    drawImage: (source, x, y, w, h) => {
      ctx.calls.push(["drawImage", source, x, y, w, h, ctx.imageSmoothingEnabled]);
    },
  };
  return ctx;
};

const GL = {
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  TEXTURE_2D: 0x0de1,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  NEAREST: 0x2600,
  CLAMP_TO_EDGE: 0x812f,
  RGBA: 0x1908,
  RGBA8: 0x8058,
  UNSIGNED_BYTE: 0x1401,
  COLOR_BUFFER_BIT: 0x4000,
  TRIANGLES: 0x0004,
};

const makeGl = (world, canvas) => {
  const gl = {
    ...GL,
    canvas,
    lost: world.glLostAtStart,
    calls: [],
    sources: [],
    params: [],
    get drawingBufferWidth() {
      return canvas.width;
    },
    get drawingBufferHeight() {
      return canvas.height;
    },
    isContextLost: () => gl.lost,
    createShader: (kind) => ({ kind }),
    shaderSource: (shader, source) => {
      gl.sources.push(source);
    },
    compileShader: () => undefined,
    getShaderParameter: () => world.glCompiles,
    getShaderInfoLog: () => "fake compile log",
    createProgram: () => ({}),
    attachShader: () => undefined,
    linkProgram: () => undefined,
    getProgramParameter: () => world.programLinks,
    getProgramInfoLog: () => "fake link log",
    createTexture: () => ({}),
    bindTexture: () => undefined,
    texParameteri: (target, name, value) => {
      gl.params.push([name, value]);
    },
    useProgram: () => undefined,
    getUniformLocation: () => ({}),
    uniform1i: () => undefined,
    clearColor: () => undefined,
    texImage2D: (...args) => {
      world.count.texImage2D++;
      gl.calls.push(["texImage2D", ...args]);
    },
    texSubImage2D: (...args) => {
      gl.calls.push(["texSubImage2D", ...args]);
    },
    viewport: (...args) => {
      gl.calls.push(["viewport", ...args]);
    },
    clear: () => undefined,
    drawArrays: (...args) => {
      gl.calls.push(["drawArrays", ...args]);
    },
    deleteTexture: () => {
      if (world.glDeleteThrows) {
        throw new Error("fake deleteTexture error");
      }
      world.count.glDeleted++;
    },
    deleteShader: () => {
      world.count.glShadersDeleted++;
    },
    deleteProgram: () => {
      world.count.glProgramsDeleted++;
    },
    getExtension: (name) =>
      name === "WEBGL_lose_context"
        ? {
            loseContext: () => {
              gl.lost = true;
              world.count.glContextsLost++;
            },
          }
        : null,
  };
  return gl;
};

const makeGpuContext = (world) => {
  const view = { kind: "canvas view" };
  const context = {
    configured: null,
    configure: (config) => {
      if (world.configureFails) {
        throw new Error("fake configure error");
      }
      context.configured = config;
    },
    unconfigured: 0,
    unconfigure: () => {
      context.configured = null;
      context.unconfigured++;
    },
    getCurrentTexture: () => ({ createView: () => view }),
  };
  world.gpuContext = context;
  return context;
};

const makeDevice = (world) => {
  let resolveLost = null;
  const listeners = [];
  const passes = [];
  const device = {
    destroyed: false,
    passes,
    writes: [],
    submits: [],
    lost: new Promise((resolve) => {
      resolveLost = resolve;
    }),
    loseNow: (reason, message) => {
      resolveLost({ reason, message });
    },
    addEventListener: (type, listener) => {
      if (type === "uncapturederror") {
        listeners.push(listener);
      }
    },
    removeEventListener: (type, listener) => {
      const at = listeners.indexOf(listener);
      if (at >= 0) {
        listeners.splice(at, 1);
      }
    },
    raise: (message) => {
      for (const listener of listeners.slice()) {
        listener({ error: new Error(message) });
      }
    },
    listenerCount: () => listeners.length,
    destroy: () => {
      device.destroyed = true;
      resolveLost({ reason: "destroyed", message: "the device was destroyed" });
    },
    createShaderModule: (descriptor) => {
      if (world.shaderModuleFails) {
        throw new Error("fake shader module error");
      }
      return { code: descriptor.code };
    },
    createRenderPipelineAsync: (descriptor) => {
      if (world.pipelineFails) {
        return Promise.reject(new Error("fake pipeline error"));
      }
      world.pipeline = descriptor;
      const pipeline = { getBindGroupLayout: () => ({}) };
      if (world.pipelineGated) {
        // The test resolves it with `world.finishPipeline()`, after doing what
        // it wants done while the pipeline builds.
        return new Promise((resolve) => {
          world.finishPipeline = () => resolve(pipeline);
        });
      }
      return Promise.resolve(pipeline);
    },
    createSampler: (descriptor) => {
      world.sampler = descriptor;
      return { descriptor };
    },
    createTexture: (descriptor) => {
      world.count.createTexture++;
      world.textureDescriptor = descriptor;
      const texture = {
        width: descriptor.size.width,
        height: descriptor.size.height,
        destroyed: false,
        createView: () => ({ texture }),
        destroy: () => {
          texture.destroyed = true;
        },
      };
      return texture;
    },
    createBindGroup: (descriptor) => {
      world.count.createBindGroup++;
      return { texture: descriptor.entries[0].resource.texture };
    },
    createCommandEncoder: () => ({
      beginRenderPass: (descriptor) => {
        const pass = { descriptor, calls: [] };
        passes.push(pass);
        const record =
          (name) =>
          (...args) => {
            pass.calls.push([name, ...args]);
          };
        return {
          setPipeline: record("setPipeline"),
          setBindGroup: record("setBindGroup"),
          setViewport: record("setViewport"),
          draw: record("draw"),
          end: record("end"),
        };
      },
      finish: () => ({ kind: "command buffer" }),
    }),
    queue: {
      writeTexture: (destination, data, layout, size) => {
        device.writes.push({ destination, data, layout, size, texture: destination.texture });
      },
      submit: (buffers) => {
        device.submits.push(buffers);
      },
    },
  };
  world.device = device;
  return device;
};

/**
 * A browser to run the presenter in. Its fields say which steps refuse:
 * `gpu: false` hides `navigator.gpu`, `adapter: null` answers no adapter,
 * `adapter: "throw"` rejects, `deviceFails` rejects `requestDevice`,
 * `configureFails` and `shaderModuleFails` throw from `configure` and
 * `createShaderModule`, `pipelineFails` rejects the pipeline, `pipelineGated`
 * holds it until `world.finishPipeline()`, `glCompiles: false` and
 * `programLinks: false` fail the WebGL 2 shader and program,
 * `glLostAtStart` hands out a WebGL 2 context already lost,
 * `offscreen2d: false` makes the framebuffer-sized canvas refuse a 2D
 * context, `contexts` lists the context types the page's canvas will hand
 * out, and `glDeleteThrows` makes `deleteTexture` throw.
 */
export class World {
  constructor(settings) {
    const s = settings || {};
    this.gpu = s.gpu !== false;
    this.adapter = s.adapter === undefined ? "ok" : s.adapter;
    this.deviceFails = s.deviceFails === true;
    this.pipelineFails = s.pipelineFails === true;
    this.pipelineGated = s.pipelineGated === true;
    this.finishPipeline = null;
    this.configureFails = s.configureFails === true;
    this.shaderModuleFails = s.shaderModuleFails === true;
    this.glCompiles = s.glCompiles !== false;
    this.programLinks = s.programLinks !== false;
    this.glLostAtStart = s.glLostAtStart === true;
    this.offscreen2d = s.offscreen2d !== false;
    this.glDeleteThrows = s.glDeleteThrows === true;
    this.contexts = new Set(s.contexts || ["webgpu", "webgl2", "2d"]);
    this.count = { createTexture: 0, createBindGroup: 0, createImageData: 0, texImage2D: 0, glDeleted: 0,
      glShadersDeleted: 0, glProgramsDeleted: 0, glContextsLost: 0 };
    this.requests = { adapter: 0, device: 0 };
    this.canvases = [];
    this.device = null;
    this.gpuContext = null;
    this.document = {
      createElement: (tag) => {
        if (tag !== "canvas") {
          throw new Error(`the presenter made a <${tag}>`);
        }
        // The framebuffer-sized canvas is offscreen: it gives a 2D context
        // unless `offscreen2d` is false.
        const canvas = new FakeCanvas(this, { offscreen: "yes" });
        canvas.offscreen = true;
        return canvas;
      },
    };
    this.page = { children: [] };
    this.canvas = new FakeCanvas(this, { id: "screen", class: "frame", style: "width: 100%" });
    this.canvas.parent = this.page;
    this.page.children.push(this.canvas);
  }

  makeContext(canvas, type, options) {
    if (canvas.offscreen === true) {
      return type === "2d" && this.offscreen2d ? make2d(this, canvas) : null;
    }
    if (!this.contexts.has(type)) {
      return null;
    }
    if (type === "webgpu") {
      return makeGpuContext(this);
    }
    if (type === "webgl2") {
      const gl = makeGl(this, canvas);
      gl.options = options;
      return gl;
    }
    if (type === "2d") {
      const ctx = make2d(this, canvas);
      ctx.options = options;
      return ctx;
    }
    return null;
  }

  /** The canvas in the page now: a fallback may have replaced the first. */
  get current() {
    return this.page.children[0];
  }

  /** Installs this world's `navigator` on `globalThis`. */
  install() {
    const world = this;
    const gpu = {
      getPreferredCanvasFormat: () => "bgra8unorm",
      requestAdapter: async () => {
        world.requests.adapter++;
        if (world.adapter === "throw") {
          throw new Error("fake adapter failure");
        }
        if (world.adapter === null) {
          return null;
        }
        return {
          requestDevice: async () => {
            world.requests.device++;
            if (world.deviceFails) {
              throw new Error("fake device failure");
            }
            return makeDevice(world);
          },
        };
      },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: this.gpu ? { gpu } : {},
      configurable: true,
      writable: true,
    });
    return this;
  }
}

/**
 * An animation-frame clock the test drives: `tick(ms)` runs the pending
 * callback at that time. `cancelled` lists every handle cancelled.
 */
export const installClock = () => {
  const clock = { pending: null, handle: 0, cancelled: [], requested: 0 };
  globalThis.requestAnimationFrame = (callback) => {
    clock.pending = callback;
    clock.requested++;
    clock.handle++;
    return clock.handle;
  };
  globalThis.cancelAnimationFrame = (handle) => {
    clock.cancelled.push(handle);
    if (handle === clock.handle) {
      clock.pending = null;
    }
  };
  clock.tick = (now) => {
    const callback = clock.pending;
    clock.pending = null;
    if (callback !== null) {
      callback(now);
    }
    return callback !== null;
  };
  return clock;
};
