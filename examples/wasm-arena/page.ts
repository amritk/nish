// The page of examples/wasm-arena (docs/wp50-wasm-host.md §10, W9). It loads
// client.wasm, writes key presses into the module's input ring through a view
// made once, calls `frame(dtMs)` from `requestAnimationFrame`, and hands the
// instance list the frame laid out to the GPU straight from linear memory:
// `queue.writeBuffer` under WebGPU, `bufferSubData` under WebGL 2. Every view
// is made at start-up; the memory is fixed by `--memory`, so none goes stale.
//
// build.mjs strips the types and rewrites the three imports below to the files
// it writes beside it (client.mjs, host.js, nish-page.mjs).
//
// smoke: skip a browser page, built by build.mjs, not a native program
import { ringOver } from "nish/page"
import { type Exports, loadSync } from "./client"
import * as host from "./host"
import { type Gpu, gpu } from "./host"

/**
 * The input bit of sim.ts the key `code` sets: up 1, down 2, left 4, right 8,
 * fire 16; 0 for a key the arena does not read.
 *
 * @param code - a `KeyboardEvent.code`
 * @returns the bit, or 0
 */
export const keyBits = (code: string): number => {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return 1
    case "ArrowDown":
    case "KeyS":
      return 2
    case "ArrowLeft":
    case "KeyA":
      return 4
    case "ArrowRight":
    case "KeyD":
      return 8
    case "Space":
      return 16
    default:
      return 0
  }
}

/** Every input bit the arena reads, for a release of all of them. */
const ALL_KEYS: number = 31

/** One key per input bit, for a script that types: bit 1 is ArrowUp, and so on. */
export const CODES: readonly string[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]

/** What the page draws with: the host module's two shader calls, then the frames. */
export interface Renderer extends Gpu {
  /** Makes the instance buffer, `bytes` long, before the module's `init` runs. */
  prepare(bytes: number): void
  /** Draws `n` instances, four floats each, from `f32[at ...]`. */
  draw(f32: Float32Array, at: number, n: number): void
}

/** A loaded arena and the record of what it stepped. */
export interface Arena {
  readonly module: Exports
  /** Whether the page renders with WebGPU; false is WebGL 2. */
  readonly webgpu: boolean
  /** Puts the press of `bits` in the input ring; false when the ring is full. */
  press(bits: number): boolean
  /** Puts the release of `bits` in the input ring; false when the ring is full. */
  release(bits: number): boolean
  /** Steps the arena over `dtMs` and draws it; answers the instances drawn. */
  frame(dtMs: number): number
  /** Each tick's input word, in order, as the replay takes them. */
  readonly log: Int32Array
  /** The words `log` holds. */
  logged(): number
  /** The ticks stepped past `log`'s end, unrecorded. */
  overflow(): number
  /** The state's hash, 16 hex digits, as replay prints it. */
  hash(): string
}

/**
 * Loads the arena from `bytes` and starts it from `seed`. Nothing it answers
 * allocates per frame but the loader's call wrapper and the renderer's own
 * objects: under WebGPU, a command encoder, its pass, its command buffer and
 * the canvas texture's view, each frame, which the browser's API gives no way
 * to reuse. The log is made here, `logCap` words long.
 *
 * @param bytes - client.wasm
 * @param renderer - the GPU path, or a stub under Node
 * @param seed - the simulation's seed
 * @param logCap - the most ticks to record
 * @returns the running arena
 */
export const startArena = (bytes: BufferSource, renderer: Renderer, seed: number, logCap: number): Arena => {
  gpu.current = renderer
  const module = loadSync(bytes, { host })
  const ring = ringOver(module.memory, module.layout.INPUT)
  const f32 = new Float32Array(module.memory.buffer)
  const stepped = module.views().storage.STEPPED
  const at = module.layout.INSTANCES.at / 4
  const log = new Int32Array(logCap)
  let count = 0
  let lost = 0
  renderer.prepare(module.layout.INSTANCES.length * 4)
  const webgpu = module.init(seed) === 1
  const frame = (dtMs: number): number => {
    const n = module.frame(dtMs)
    const steps = stepped[0]
    for (let i = 1; i <= steps; i++) {
      if (count < logCap) {
        log[count] = stepped[i]
        count++
      } else {
        lost++
      }
    }
    renderer.draw(f32, at, n)
    return n
  }
  const hex = (word: number): string => (word >>> 0).toString(16).padStart(8, "0")
  return {
    module,
    webgpu,
    press: (bits) => ring.push(bits & 255),
    release: (bits) => ring.push((bits & 255) << 8),
    frame,
    log,
    logged: () => count,
    overflow: () => lost,
    hash: () => hex(module.hashHi()) + hex(module.hashLo()),
  }
}

/**
 * The scripted player of the soak and the Node round trip: the key word to
 * type at `frame`, a cycle of ten seconds at 60 frames a second. The low byte
 * is the bits to press, the second byte the bits to release; 0 is no event.
 *
 * @param frame - the frame's index from 0
 * @returns the event word
 */
export const scripted = (frame: number): number => {
  switch (frame % 600) {
    case 0:
      return 1
    case 45:
      return 4
    case 80:
      return 4 << 8
    case 120:
      return 16
    case 200:
      return (16 | 1) << 8
    case 210:
      return 2 | 8
    case 260:
      return (2 << 8) | 16
    case 330:
      return (8 | 16) << 8
    case 400:
      return 1 | 16
    case 540:
      return (1 | 16) << 8
    default:
      return 0
  }
}

/** The bits of a run of equal words, run-length coded as replay.ts takes them: `<count>x<word>`. */
export const runs = (log: Int32Array, n: number): string[] => {
  const out: string[] = []
  let i = 0
  while (i < n) {
    let j = i + 1
    while (j < n && log[j] === log[i]) {
      j++
    }
    out.push(`${j - i}x${log[i]}`)
    i = j
  }
  return out
}

/** The WebGPU path, or null when the browser has no adapter. */
const webgpuRenderer = async (canvas: HTMLCanvasElement): Promise<Renderer | null> => {
  const adapter = navigator.gpu === undefined ? null : await navigator.gpu.requestAdapter()
  if (adapter === null) {
    return null
  }
  const device = await adapter.requestDevice()
  const context = canvas.getContext("webgpu")
  if (context === null) {
    return null
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: "opaque" })
  let buffer: GPUBuffer | null = null
  let pipeline: GPURenderPipeline | null = null
  let group: GPUBindGroup | null = null
  const attachment: GPURenderPassColorAttachment = {
    view: context.getCurrentTexture().createView(),
    clearValue: { r: 0.02, g: 0.02, b: 0.06, a: 1 },
    loadOp: "clear",
    storeOp: "store",
  }
  const pass: GPURenderPassDescriptor = { colorAttachments: [attachment] }
  // The one-buffer list `submit` takes, made once; its slot is the frame's buffer.
  const submitted: GPUCommandBuffer[] = []
  return {
    prepare: (bytes) => {
      buffer = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
    },
    shader: (src) => {
      const module = device.createShaderModule({ code: src })
      pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: { module, entryPoint: "fs", targets: [{ format }] },
        primitive: { topology: "triangle-strip" },
      })
      if (buffer !== null) {
        group = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer } }],
        })
      }
      return true
    },
    program: () => undefined,
    draw: (f32, at, n) => {
      if (buffer === null || pipeline === null || group === null) {
        return
      }
      device.queue.writeBuffer(buffer, 0, f32, at, n * 4)
      attachment.view = context.getCurrentTexture().createView()
      const encoder = device.createCommandEncoder()
      const render = encoder.beginRenderPass(pass)
      render.setPipeline(pipeline)
      render.setBindGroup(0, group)
      render.draw(4, n)
      render.end()
      submitted[0] = encoder.finish()
      device.queue.submit(submitted)
    },
  }
}

/** The WebGL 2 path: the same quads, the instance list as one vec4 attribute. */
const webglRenderer = (canvas: HTMLCanvasElement): Renderer => {
  const gl = canvas.getContext("webgl2")
  if (gl === null) {
    throw new Error("wasm-arena: this browser has neither WebGPU nor WebGL 2")
  }
  const buffer = gl.createBuffer()
  const vao = gl.createVertexArray()
  const compile = (kind: number, src: string): WebGLShader => {
    const shader = gl.createShader(kind)
    if (shader === null) {
      throw new Error("wasm-arena: createShader failed")
    }
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      throw new Error(`wasm-arena: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }
  return {
    prepare: (bytes) => {
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0)
      gl.vertexAttribDivisor(0, 1)
    },
    shader: () => false,
    program: (vertex, fragment) => {
      const program = gl.createProgram()
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
      gl.linkProgram(program)
      if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
        throw new Error(`wasm-arena: ${gl.getProgramInfoLog(program)}`)
      }
      gl.useProgram(program)
      gl.clearColor(0.02, 0.02, 0.06, 1)
    },
    draw: (f32, at, n) => {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32, at, n * 4)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
    },
  }
}

/** What `main` was told to do besides run: a hook after each frame, and whether WebGPU may be used. */
export interface MainOptions {
  readonly seed: number
  readonly logCap: number
  readonly webgpu: boolean
  readonly afterFrame?: (arena: Arena, n: number) => void
}

/**
 * Runs the arena on `canvas`: fetches `wasmUrl`, picks WebGPU when the
 * browser has an adapter and WebGL 2 when not, listens for keys, and draws
 * a frame on every `requestAnimationFrame`.
 *
 * @param canvas - the canvas to draw on
 * @param wasmUrl - where client.wasm is served
 * @param options - the seed, the log's length and the per-frame hook
 * @returns the arena once its first frame is scheduled
 */
export const main = async (
  canvas: HTMLCanvasElement,
  wasmUrl: string,
  options: MainOptions
): Promise<Arena> => {
  const bytes = await (await fetch(wasmUrl)).arrayBuffer()
  const renderer = (options.webgpu ? await webgpuRenderer(canvas) : null) ?? webglRenderer(canvas)
  const arena = startArena(bytes, renderer, options.seed, options.logCap)
  addEventListener("keydown", (e) => {
    const bits = keyBits(e.code)
    if (bits !== 0 && !e.repeat) {
      arena.press(bits)
    }
  })
  addEventListener("keyup", (e) => {
    const bits = keyBits(e.code)
    if (bits !== 0) {
      arena.release(bits)
    }
  })
  // A key held when the page loses focus sends no keyup: release them all.
  addEventListener("blur", () => {
    arena.release(ALL_KEYS)
  })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      arena.release(ALL_KEYS)
    }
  })
  const after = options.afterFrame
  let last = -1
  const tick = (now: number): void => {
    const n = arena.frame(last < 0 ? 0 : now - last)
    last = now
    if (after !== undefined) {
      after(arena, n)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return arena
}
