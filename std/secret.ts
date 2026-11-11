/**
 * `nish:secret` — the source behind the builtin module.
 *
 * **What the module means is documented once, in `runtime/nish.d.ts`**: the
 * `declare module "nish:secret"` block there is what an editor shows and what
 * `docs/reference/nish-secret.md` is generated from, and `docs/LANGUAGE.md`
 * ("Secrets") holds the rules. The comments in this file say only how the
 * module is built; change a meaning there, not here.
 *
 * It is imported only by its builtin name: `nish/secret` is refused, so there
 * is one spelling for the checker's rules to be read under. Those rules are
 * `src/secret.ts`, which knows this module by its path and package, and the
 * volatile store `wipe` lowers to is `src/emit-secret.ts`. Under Node the
 * module is answered by `runtime/nish.mjs`.
 */

/** Key material, held opaque (`runtime/nish.d.ts`). Here, a box around one field. */
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
 * `value`, wrapped (`runtime/nish.d.ts`). The box holds `value` itself, not a
 * copy, so its storage is the storage `wipe` later zeroes.
 *
 * @param value the key material, kept as it is.
 * @returns the box.
 */
export const secret = <T>(value: T): Secret<T> => new Secret<T>(value)

/**
 * `f(value)` (`runtime/nish.d.ts`): the field read, the one this module makes.
 *
 * @param s the box to read.
 * @param f handed the held value itself.
 * @returns what `f` returns.
 */
export const expose = <T, R>(s: Secret<T>, f: (value: T) => R): R => f(s.value)

/**
 * `f(value, arg)` (`runtime/nish.d.ts`): `expose` with one more argument.
 *
 * @param s the box to read.
 * @param arg handed to `f` as its second argument.
 * @param f handed the held value itself and `arg`.
 * @returns what `f` returns.
 */
export const exposeWith = <T, A, R>(s: Secret<T>, arg: A, f: (value: T, arg: A) => R): R => f(s.value, arg)

/**
 * Zero every byte of `target`'s storage (`runtime/nish.d.ts`). Natively the
 * compiler gives each instance a body of its own, one volatile `llvm.memset`
 * (`src/emit-secret.ts`); this one is never emitted.
 *
 * @param _target what to zero.
 */
export const wipe = <T>(_target: T): void => {
  // Lowered by the compiler: see above.
}
