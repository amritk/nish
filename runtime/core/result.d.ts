/** `Result` (docs/LANGUAGE.md -> Result and error handling) and `nish:secret`, as `runtime/nish.d.ts` declares them. */
import type { u8 } from "./numbers.js";

/** The success arm of a `Result`, as the discriminant proves it. */
export type ResultOk<T> = { readonly ok: true; readonly value: T };
/** The failure arm. */
export type ResultErr<E> = { readonly ok: false; readonly error: E };

export interface ResultMethods<T, E> {
  isOk(): this is ResultOk<T> & ResultMethods<T, E>;
  isErr(): this is ResultErr<E> & ResultMethods<T, E>;
  /** The success payload, or a throw that `caught` turns into the enclosing function's `Err`. */
  orReturn(): T;
  unwrapOr(fallback: T): T;
  /** The success payload, or `message` through `panic`. */
  expect(message: string): T;
}

/** The outcome of an operation that can fail. */
export type Result<T, E> = (ResultOk<T> | ResultErr<E>) & ResultMethods<T, E>;

/** The class every `Result` is an instance of; `--emit-ts` imports it under the type's name. */
export declare const Result: { prototype: ResultMethods<unknown, unknown> };

export declare function Ok<T, E>(value: T): Result<T, E>;
export declare function Ok<E>(): Result<void, E>;
export declare function Err<T, E>(error: E): Result<T, E>;
/** The `catch` of a body that calls `orReturn`: the `Err` to return, or `thrown` thrown again. */
export declare function caught<T, E>(thrown: unknown): Result<T, E>;

/** Key material, held as a plain wrapper: under JavaScript a wipe promises nothing about copies. */
export declare class Secret<T> {
  constructor(value: T);
  readonly value: T;
}
export declare function secret<T>(value: T): Secret<T>;
export declare function expose<T, R>(s: Secret<T>, f: (value: T) => R): R;
export declare function exposeWith<T, A, R>(s: Secret<T>, arg: A, f: (value: T, arg: A) => R): R;
export declare function wipe<T>(target: Secret<T>): void;
export declare function wipe(target: object): void;
export declare function secureZero(bytes: u8[]): void;
