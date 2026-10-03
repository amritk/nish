/**
 * `nish:secret` — key material, and the rules that keep it in
 * (docs/LANGUAGE.md, "Secrets").
 *
 *     import { Secret, expose, secret, wipe } from "nish:secret"
 *
 *     const key: Secret<u8[]> = secret(readKey())
 *     const tag: u8[] = expose(key, (k: u8[]): u8[] => hmacSha256(k, message))
 *     wipe(key)
 *
 * This file is the source behind the builtin module, and it is imported only
 * by that name: `nish/secret` is refused, so there is one spelling for the
 * checker's rules to be read under. What is written here is the meaning; what
 * makes a `Secret` worth having is in `src/secret.ts`, which knows this module
 * by its path and package:
 *
 *   - a `Secret` is opaque. Nothing outside this file reads its field, builds
 *     one with `new`, prints it, interpolates it, compares it with anything but
 *     another `Secret` or `null`, branches on it, indexes it, stores it in a
 *     field, an array or a `Result`, or hands it to a builtin;
 *   - a `Secret` a function makes leaves it returned or wiped, on every path;
 *   - `expose` is the one way in, and the function it runs may reach no I/O and
 *     no C, may not keep the value, may not write the argument `exposeWith`
 *     hands it, and returns a declared type that holds no `Secret`;
 *   - `wipe` is a volatile store of zeros over the value's whole storage,
 *     which no optimiser may remove (`src/emit-secret.ts`).
 *
 * Under Node the module is answered by `runtime/shim.mjs`, where a `Secret` is
 * a plain wrapper and `wipe` zero-fills it.
 */

/**
 * Key material: an array of integers (`u8[]`, `u32[]`, ...) or a record whose
 * every field is an integer. Made by `secret`, read only through `expose`.
 */
export class Secret<T> {
  /** The wrapped value. Only this module reads or writes it (`src/secret.ts`). */
  value: T

  constructor(value: T) {
    this.value = value
  }
}

/** `value`, wrapped. The argument is moved: a local handed in is not read again. */
export const secret = <T>(value: T): Secret<T> => new Secret<T>(value)

/** `f(value)`: the one way to compute with what a `Secret` holds. */
export const expose = <T, R>(s: Secret<T>, f: (value: T) => R): R => f(s.value)

/** `f(value, arg)`: `expose` with one more argument, because an arrow captures nothing. */
export const exposeWith = <T, A, R>(s: Secret<T>, arg: A, f: (value: T, arg: A) => R): R => f(s.value, arg)

/**
 * Zero every byte of `target`'s storage: a `Secret`'s value, or an array or
 * record of integers that `expose`'s function holds. Natively the compiler
 * gives each instance a body of its own, one volatile `llvm.memset`
 * (`src/emit-secret.ts`); this one is never emitted.
 */
export const wipe = <T>(_target: T): void => {
  // Lowered by the compiler: see above.
}
