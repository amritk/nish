// The host module of examples/wasm-arena: the functions client.ts imports and
// the page supplies. The build reads only the exported signatures; the bodies
// are the page's own TypeScript (docs/guide/using-nish/interop.md).
import type { i32 } from "nish"

/** What the page renders with, set by page.ts before `init` runs. */
export interface Gpu {
  /** Compiles a WGSL module; false when the page has no WebGPU device. */
  shader(src: string): boolean
  /** Compiles and links a WebGL 2 program from GLSL ES 3.00 sources. */
  program(vertex: string, fragment: string): void
}

const none: Gpu = {
  shader: () => false,
  program: () => undefined,
}

/** The renderer the calls below go to; page.ts sets it, a test leaves the stub. */
export const gpu: { current: Gpu } = { current: none }

/**
 * Hands the page the WGSL text the client generated at start-up.
 *
 * @param src - the shader module's source
 * @returns 1 when WebGPU took it, 0 when the page renders with WebGL 2 instead
 */
export function gpuCreateShader(src: string): i32 {
  return gpu.current.shader(src) ? 1 : 0
}

/**
 * Hands the page the GLSL pair for the WebGL 2 path, used when
 * `gpuCreateShader` answers 0.
 *
 * @param vertex - the vertex shader's source
 * @param fragment - the fragment shader's source
 */
export function glCreateProgram(vertex: string, fragment: string): void {
  gpu.current.program(vertex, fragment)
}
