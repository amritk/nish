/**
 * `nish/page/frame`: puts a wasm module's 0xRRGGBB framebuffer on a canvas
 * through WebGPU, WebGL 2 or Canvas 2D, and runs a fixed-step loop that
 * renders on every animation frame (docs/guide/using-nish/interop.md).
 */

/** A way of drawing on the canvas, best first: WebGPU, WebGL 2, Canvas 2D. */
export type Backend = "webgpu" | "webgl2" | "canvas2d";

/** A tier given up, and why: refused when it was built, or lost later. */
export interface Attempt {
  /** The tier given up. */
  readonly backend: Backend;
  /** What refused or lost it, as the browser reported it. */
  readonly reason: string;
}

/** What `createPresenter` takes beyond the canvas. */
export interface PresenterOptions {
  /** The tier to start from; the tiers above it are not tried. WebGPU by default. */
  readonly prefer?: Backend;
  /**
   * Called each time a tier is given up for the next one, when the presenter
   * is created or later, on a lost device or context. An error it throws is
   * passed to `reportError` and the fallback goes on.
   *
   * @param from - the tier given up
   * @param to - the tier tried next
   * @param reason - why `from` was given up
   * @param canvas - the canvas `to` builds on: a fresh one when `from` had
   *   taken a context, the place to add the page's listeners again (during
   *   `createPresenter`, before `presenter` exists, the only way to reach it)
   */
  onFallback?(from: Backend, to: Backend, reason: string, canvas: HTMLCanvasElement): void;
}

/** Draws a framebuffer on a canvas, letterboxed to keep its aspect, nearest-neighbour scaled. */
export interface Presenter {
  /** The tier presenting now; after every tier is lost, the last one tried. */
  readonly backend: Backend;
  /** Every tier refused or lost so far, in order. */
  readonly attempts: readonly Attempt[];
  /**
   * The canvas presented on. A fallback after a tier has taken a context puts
   * a fresh canvas in the old one's place (same attributes, no listeners), so
   * read this again after `onFallback`. A canvas outside the document has no
   * place to give: its fresh canvas is outside the document too, for the page
   * to put where it wants.
   */
  readonly canvas: HTMLCanvasElement;
  /**
   * Draws `width` by `height` pixels of `pixels`, row-major 0xRRGGBB words; the
   * top byte is ignored. Pass the view into the module's memory: it is read,
   * never kept past the call or copied first.
   *
   * @param pixels - the framebuffer, at least `width * height` words
   * @param width - its width in pixels, a whole number of at least 1
   * @param height - its height in pixels, a whole number of at least 1
   */
  present(pixels: Int32Array, width: number, height: number): void;
  /**
   * Sizes the canvas's drawing buffer to its CSS size in device pixels, at
   * least 1 by 1. A size that is not finite or is below 0, or a ratio that is
   * not above 0, is a `RangeError`.
   *
   * @param cssWidth - the canvas's width in CSS pixels
   * @param cssHeight - the canvas's height in CSS pixels
   * @param devicePixelRatio - device pixels per CSS pixel
   */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
  /** Releases the tier's device or context; `present` then draws nothing, and no fallback follows. */
  destroy(): void;
}

/**
 * Makes a presenter on `canvas`, trying WebGPU, then WebGL 2, then Canvas 2D,
 * and keeping the first that builds. A tier lost later is replaced by the next
 * one down, on a fresh canvas element when the old one already holds a context.
 *
 * @param canvas - the canvas to present on
 * @param options - the tier to start from and the fallback callback
 * @returns the presenter; it rejects, naming every tier's reason, when no tier builds
 */
export declare function createPresenter(
  canvas: HTMLCanvasElement,
  options?: PresenterOptions
): Promise<Presenter>;

/** What `runFixedStep` takes. */
export interface FixedStepOptions {
  /** How many times a second `step` runs. */
  readonly stepsPerSecond: number;
  /** The most steps one frame runs; the backlog past it is dropped. 8 by default. */
  readonly maxStepsPerFrame?: number;
  /** Advances the program one fixed step. */
  step(): void;
  /**
   * Draws a frame; called on every animation frame.
   *
   * @param alpha - how far into the next step this frame is, in [0, 1)
   * @param frameMs - the frame's length in milliseconds, at most 250; 0 on the first frame
   */
  render(alpha: number, frameMs: number): void;
}

/** A running loop. */
export interface FixedStepLoop {
  /** Ends the loop and cancels its next frame. */
  stop(): void;
  /** The display's refresh rate, read from the fastest recent frame intervals; 0 before the second frame. */
  readonly refreshHz: number;
  /** Renders per second over the last half second or so; 0 until one has passed. */
  readonly fps: number;
}

/**
 * Runs `step` at a fixed rate and `render` on every animation frame. A frame
 * longer than a quarter second counts as a quarter second.
 *
 * @param options - the step rate, the per-frame step limit and the callbacks
 * @returns the running loop
 */
export declare function runFixedStep(options: FixedStepOptions): FixedStepLoop;
