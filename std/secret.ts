/**
 * `nish:secret` — key material, and the rules that keep it in
 * (docs/LANGUAGE.md, "Secrets").
 *
 *     import { Secret, exposeWith, secret, wipe } from "nish:secret"
 *     import { hmacSha256 } from "nish/crypto/hmac"
 *
 *     const tag = (k: u8[], message: u8[]): u8[] => hmacSha256(k, message)
 *
 *     const raw: u8[] = new Array<u8>(32)
 *     crypto.getRandomValues(raw)
 *     const key: Secret<u8[]> = secret(raw)          // `raw` is moved: not read again
 *     const message: u8[] = [1, 2, 3]
 *     const mac: u8[] = exposeWith(key, message, tag)
 *     wipe(key)
 *
 * **This file is the source behind the builtin module**, and it is imported
 * only by that name: `nish/secret` is refused, so there is one spelling for the
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
 * **Under Node the module is answered by `runtime/shim.mjs`**, where a
 * `Secret` is a plain wrapper and `wipe` zero-fills it.
 */

/**
 * Key material: an array of integers (`u8[]`, `u32[]`, ...) or a record whose
 * every field is an integer. Made by `secret`, read only through `expose`.
 */
export class Secret<T> {
  /** @internal Used by `expose` and `exposeWith`. The wrapped value. Only this module reads or writes it (`src/secret.ts`). */
  value: T

  /**
   * Wraps `value`. Only `secret` calls this: `new Secret` anywhere else is
   * refused (NL2437).
   *
   * @param value the key material to hold, kept as it is, not copied.
   */
  constructor(value: T) {
    this.value = value
  }
}

/**
 * `value`, wrapped. The argument is moved: a local handed in is not read again.
 *
 * @param value the key material: an array of integers or a record whose every
 *   field is an integer, that nothing else holds (NL2512).
 * @returns a `Secret` holding `value` itself, not a copy, so its storage is
 *   the storage `wipe` later zeroes.
 */
export const secret = <T>(value: T): Secret<T> => new Secret<T>(value)

/**
 * `f(value)`: the one way to compute with what a `Secret` holds.
 *
 * @param s the secret to read. It is not used up: it can be exposed again,
 *   and is still to be wiped.
 * @param f the computation, handed the held value itself. The checker holds
 *   it to the rules in the module header: no I/O, no C, it does not keep the
 *   value, and its declared result type holds no `Secret`.
 * @returns what `f` returns.
 */
export const expose = <T, R>(s: Secret<T>, f: (value: T) => R): R => f(s.value)

/**
 * `f(value, arg)`: `expose` with one more argument, because the arrow `expose`
 * runs captures nothing.
 *
 * @param s the secret to read, as for `expose`.
 * @param arg handed to `f` as its second argument. `f` may read it but not
 *   write it.
 * @param f the computation, under the same rules as `expose`'s.
 * @returns what `f` returns.
 */
export const exposeWith = <T, A, R>(s: Secret<T>, arg: A, f: (value: T, arg: A) => R): R => f(s.value, arg)

/**
 * Zero every byte of `target`'s storage: a `Secret`'s value, or an array or
 * record of integers that `expose`'s function holds. Natively the compiler
 * gives each instance a body of its own, one volatile `llvm.memset`
 * (`src/emit-secret.ts`); this one is never emitted.
 *
 * @param _target what to zero: a `Secret`, never a nullable one (narrow it
 *   first), or an array or record of integers that `expose`'s function
 *   holds.
 */
export const wipe = <T>(_target: T): void => {
  // Lowered by the compiler: see above.
}
