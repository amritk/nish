/**
 * The host the core runs on, and every builtin that asks it. Import
 * `nish/runtime/node` or `nish/runtime/browser` to install one; until then each
 * of these throws a `NishNoHost`.
 */
import type { f64, i32, i64, u8 } from "./numbers.js";

/** What an adapter installs: `exit` never returns, and `call` answers the builtin `name`. */
export interface Host {
  writeOut(s: string): void;
  writeErr(s: string): void;
  exit(code: number): never;
  argv(): string[];
  call(name: string, args: unknown[]): unknown;
}

/** What every member of the default host throws: no adapter has been imported. */
export declare class NishNoHost extends Error {
  constructor(name: string);
  readonly requested: string;
}

export declare function installHost(next: Host): void;
export declare function log(x: unknown): void;
export declare function error(x: unknown): void;
export declare function write(s: string): void;
export declare function writeError(s: string): void;
export declare function panic(message: string): never;
export declare function exit(code: i32): never;
export declare function argv(): string[];
export declare function readFileSync(path: string): string;
export declare function readFileSyncOrNull(path: string): string | null;
export declare function readFileBytesSync(path: string): u8[] | null;
export declare function writeFileSync(path: string, data: string): void;
export declare function appendFileSync(path: string, data: string): void;
export declare function mkdirSync(path: string): boolean;
export declare function isDirectorySync(path: string): boolean;
export declare function readdirSync(path: string): string[] | null;
export declare function realpathSync(path: string): string | null;
export declare function platform(): string;
export declare function arch(): string;
export declare function getenv(name: string): string | null;
export declare function spawnSync(argv: string[]): number;
export declare function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
export declare function kill(pid: i32, sig: i32): i32;
export declare function availableParallelism(): i32;
export declare function totalMemory(): i64;
export declare function monotonicNanos(): i64;
export declare function statMtimeSync(path: string): f64;
export declare function lstatOwnerModeSync(path: string): i64;
export declare function geteuid(): i64;
export declare function isExecutableSync(path: string): boolean;
/** `crypto.getRandomValues(bytes)` for a `u8[]`; a typed array goes straight through. */
export declare function getRandomValues<T extends u8[] | Uint8Array>(bytes: T): T;
/** These four have no synchronous reading: each throws, naming itself, and is typed as `runtime/nish.d.ts` types it. */
export declare function spawn(argv: string[]): i32;
export declare function waitPid(pid: i32, flags: i32): i32[];
export declare function signalFd(): i32;
export declare function readSignal(fd: i32): i32;
/** What each `nish:net` function is under the core: a throw naming `name`. */
export declare function noNetReading(name: string): never;
