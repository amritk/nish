/**
 * `nish/page/game`: runs a wasm module built over `nish/host/game` on a
 * canvas: the keyboard, pointer and touch read into its input ring, its
 * sounds played through Web Audio, its framebuffer presented by
 * `nish/page/frame` at a fixed step rate (docs/guide/using-nish/browser-games.md).
 */
import type { Backend, Presenter } from "./page-frame.js";

export type { Backend, Presenter } from "./page-frame.js";

/** A rectangle of the canvas, in fractions of its CSS box, that holds a key down while a finger is on it. */
export interface TouchZone {
  /** The left edge, 0 at the canvas's left and 1 at its right. */
  readonly x: number;
  /** The top edge, 0 at the canvas's top and 1 at its bottom. */
  readonly y: number;
  /** The width, as a fraction of the canvas's width. */
  readonly width: number;
  /** The height, as a fraction of the canvas's height. */
  readonly height: number;
  /** The `KeyboardEvent.key` the zone holds down, such as `"ArrowLeft"`. */
  readonly key: string;
}

/** How touches reach the game: as keys held by zones, and a tap. */
export interface TouchOptions {
  /** The zones, first match wins; a touch outside every zone holds nothing. */
  readonly zones: readonly TouchZone[];
  /** The key a short, still touch presses and releases, such as `"Enter"`; none when absent or empty. */
  readonly tap?: string;
}

/** The generated loader of a module built with `--emit-dts` (`game.mjs`), as far as `startGame` reads it. */
export interface GameLoader {
  /**
   * Instantiates the module.
   *
   * @param source - the compiled module
   * @param imports - the page's imports, passed through from `GameOptions.imports`
   * @returns the module's exports
   */
  load(source: WebAssembly.Module, imports?: object): Promise<unknown>;
}

/** What `startGame` takes beyond the canvas and the module's URL. */
export interface GameOptions {
  /** The seed passed to `init`; the clock's milliseconds by default. */
  readonly seed?: number;
  /**
   * The `KeyboardEvent.key` names the game reads; others, and any key held
   * with Ctrl, Alt or Meta, reach the page untouched. `DEFAULT_KEYS` by default.
   */
  readonly keys?: readonly string[];
  /** The touch zones and tap; `false` reads touches as nothing. `DEFAULT_TOUCH` by default. */
  readonly touch?: TouchOptions | false;
  /** How many times a second `step` runs. 60 by default. */
  readonly stepsPerSecond?: number;
  /** The most steps one display frame runs; the backlog past it is dropped. 8 by default. */
  readonly maxStepsPerFrame?: number;
  /** `false` asks the module for no sounds; `{ muted: true }` starts muted. On by default. */
  readonly sound?: false | { readonly muted?: boolean };
  /** The presenter tier to start from; the tiers above it are not tried. WebGPU by default. */
  readonly prefer?: Backend;
  /**
   * Called each time a presenter tier is given up for the next one. The
   * game's listeners have already moved to `canvas`.
   *
   * @param from - the tier given up
   * @param to - the tier tried next
   * @param reason - why `from` was given up
   * @param canvas - the canvas `to` presents on
   */
  onFallback?(from: Backend, to: Backend, reason: string, canvas: HTMLCanvasElement): void;
  /**
   * Called once when the module throws (a panic) in `step` or `draw`, or its
   * frame cannot be presented. The game has already stopped, as `stop()`
   * stops it. Without it the error is thrown from the animation frame.
   *
   * @param error - what was thrown
   */
  onError?(error: unknown): void;
  /** Aborting it rejects a start still loading with its reason, or stops a running game. */
  readonly signal?: AbortSignal;
  /** The module's generated loader; the `.mjs` beside the `.wasm` is imported when absent. */
  readonly loader?: GameLoader;
  /** The loader's URL, read against the page's base URL, when `loader` is absent and it is not the `.mjs` beside the `.wasm`. */
  readonly loaderUrl?: string | URL;
  /** Imports passed to the loader's `load`, such as `onPanic`. */
  readonly imports?: object;
}

/** A game started by `startGame`. */
export interface Game {
  /** The presenter drawing the frames; read `presenter.canvas` again after a fallback. */
  readonly presenter: Presenter;
  /** The module's exports, as its loader returned them. */
  readonly module: unknown;
  /** Frames drawn per second over the last half second or so; 0 until one has passed. */
  readonly fps: number;
  /** The display's refresh rate; 0 before the second frame. */
  readonly refreshHz: number;
  /** Whether sounds the game plays are dropped. */
  muted: boolean;
  /** Whether the loop runs: false after `stop()`, an abort, or an error. */
  readonly running: boolean;
  /** Ends the loop, removes the listeners, closes the audio and releases the presenter. */
  stop(): void;
}

/** The keys a game reads unless `GameOptions.keys` says otherwise: the arrows, space, Enter and Escape. */
export declare const DEFAULT_KEYS: readonly string[];

/** The touch zones unless `GameOptions.touch` says otherwise: each half of the canvas steers, and a tap is Enter. */
export declare const DEFAULT_TOUCH: TouchOptions;

/**
 * Loads a game built over `nish/host/game` and runs it on `canvas`. The
 * module must export `init(seed)`, `step(nowMs)` and `draw(alpha, frameMs)`;
 * `sound(id)` and `resize(width, height)` are optional. `init` runs once;
 * `sound` runs for ids 0, 1, ... until it answers 0; then `step` runs
 * `stepsPerSecond` times a second and `draw` once per display frame.
 *
 * @param canvas - the canvas to draw on; a fallback may replace it, see `presenter.canvas`
 * @param wasmUrl - the module's URL, read against the page's base URL
 * @param options - the seed, the keys and touch zones the game reads, the sound, the tier, the loader
 * @returns the running game; it rejects when an option is malformed, the start is aborted, or the module cannot be fetched or lacks an export or storage it needs
 */
export declare function startGame(
  canvas: HTMLCanvasElement,
  wasmUrl: string | URL,
  options?: GameOptions
): Promise<Game>;
