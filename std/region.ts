/**
 * `nish:region` — memory a program frees when it says so (docs/LANGUAGE.md,
 * "Regions").
 *
 *     import { Region, enter, free, regionWith } from "nish:region"
 *
 *     class Session {
 *       hits: i32 = 0
 *       payload: u8[]
 *       constructor(size: i32) {
 *         this.payload = new Array<u8>(size)
 *       }
 *     }
 *
 *     const open = (size: i32): Session => new Session(size)
 *     const hit = (s: Session): i32 => {
 *       s.hits = s.hits + 1
 *       return s.hits
 *     }
 *
 *     const r: Region<Session> = regionWith(16, open)  // the Session lives in r
 *     const n: i32 = enter(r, hit)                      // 1: a number comes out
 *     free(r)                                           // r is dead from here
 *
 * **This file is the source behind the builtin module**, and it is imported
 * only by that name: `nish/region` is refused, so there is one spelling for the
 * checker's rules to be read under (`src/region-check.ts`). What is written
 * here is the meaning, over six intrinsics the compiler gives bodies of their
 * own (`src/emit-region.ts`), which swap the thread's arena for the region's
 * around the function they run:
 *
 *   - `region(f)` makes a region, runs `f` with every allocation landing in
 *     it, and keeps what `f` answers as the region's root;
 *   - `enter(r, f)` runs `f(root)` the same way, and answers `f`'s scalar;
 *   - `free(r)` gives the region's memory back, and its children's. A handle
 *     used after it is freed, or entered twice, or freed while it or a child
 *     is entered, stops the program;
 *   - `child(f)` and `childWith(arg, f)`, inside an `enter`, make a region
 *     whose parent is the one entered: it may keep what the parent's root
 *     reaches, and is freed with the parent.
 *
 * **A `Region<T>` is a handle**, a 64-bit integer, and not a pointer: the root
 * never leaves the region except through `enter`'s function, and that
 * function answers a scalar, so nothing outside a region can point into it.
 *
 * **Under Node the module is answered by `runtime/nish.mjs`**, where a region
 * is an entry in a table and `free` drops it.
 */

/**
 * A region whose root is a `T`. The compiler resolves the name to a type of
 * its own, a 64-bit handle; this declaration is what `tsc` and the editor
 * read through `runtime/nish.d.ts`.
 */
export class Region<T> {
  /** @internal Never read: the compiler's type has no fields. */
  root: T | null = null
}

// The six intrinsics below are the runtime's region calls. Each is written
// here as a call of itself, so it has a type and nothing more; the compiler
// gives every instance a body of its own (`src/emit-region.ts`), one call into
// `runtime/runtime-region.c`.

/** `nish_region_new`: a fresh handle, never 0. */
const handleNew = (): i64 => handleNew()

/** `nish_region_enter` on a new region, whose root is still null. */
const open = (h: i64): void => open(h)

/** `nish_region_leave` keeping `root`: the handle, typed by its root. */
const close = <T>(h: i64, root: T): Region<T> => close(h, root)

/** `nish_region_enter` on a made region: its root. */
const reopen = <T>(r: Region<T>): T => reopen(r)

/** `nish_region_leave` with the root `reopen` gave. */
const leave = <T>(r: Region<T>, root: T): void => leave(r, root)

/** `nish_region_child_new`: a fresh handle whose parent is the region entered now. */
const childNew = (): i64 => childNew()

/**
 * A new region, whose root is what `f` answers; everything `f` allocates is in
 * it.
 *
 * @param f builds the root. What it answers must be memory it allocated
 *   (NL2614), and the checker refuses it storing region memory anywhere
 *   outside the region (NL2609).
 * @returns the handle to the new region, which holds its memory until `free`.
 */
export const region = <T>(f: () => T): Region<T> => {
  const h: i64 = handleNew()
  open(h)
  return close(h, f())
}

/**
 * `region` with one argument for `f`, because the arrow `region` runs captures
 * nothing.
 *
 * @param arg handed to `f`. It lives outside the region, so unless it is a
 *   number, `boolean` or `enum` `f` may not store it into region memory
 *   (NL2610), a string included.
 * @param f builds the root from `arg`, under the same rules as `region`'s.
 * @returns the handle to the new region, which holds its memory until `free`.
 */
export const regionWith = <A, T>(arg: A, f: (arg: A) => T): Region<T> => {
  const h: i64 = handleNew()
  open(h)
  return close(h, f(arg))
}

/**
 * `f(root)`, allocating in the region: the one way to reach what a region holds.
 *
 * @param r the region to enter. A handle that is 0, freed, another thread's or
 *   already entered stops the program.
 * @param f runs on the root, and everything it allocates lands in the region.
 *   It answers a number, a `boolean`, an `enum` or a `Region` (NL2611), so
 *   nothing it answers points into the region.
 * @returns what `f` returns.
 */
export const enter = <T, R>(r: Region<T>, f: (root: T) => R): R => {
  const root: T = reopen(r)
  const result: R = f(root)
  leave(r, root)
  return result
}

/**
 * `enter` with one argument for `f`.
 *
 * @param r the region to enter, checked as `enter` checks it.
 * @param arg handed to `f` after the root. It lives outside the region, under
 *   the same rule as `regionWith`'s `arg` (NL2610).
 * @param f runs on the root and `arg`, under the same rules as `enter`'s.
 * @returns what `f` returns.
 */
export const enterWith = <T, A, R>(r: Region<T>, arg: A, f: (root: T, arg: A) => R): R => {
  const root: T = reopen(r)
  const result: R = f(root, arg)
  leave(r, root)
  return result
}

/**
 * A new region whose parent is the region entered now: `region`, except that
 * the child may keep the parent's memory that `enter` handed in, and freeing
 * the parent frees the child. Written only in the function an `enter` or
 * `enterWith` runs (NL2697).
 *
 * @param f builds the child's root, under `region`'s rules, except that it may
 *   store into the child what the parent's root reaches. What the entered
 *   function allocated in the parent it may not (NL2610).
 * @returns the handle to the child, which holds its memory until `free` of it
 *   or of its parent.
 */
export const child = <T>(f: () => T): Region<T> => {
  const h: i64 = childNew()
  open(h)
  return close(h, f())
}

/**
 * `child` with one argument for `f`: the way the parent's memory reaches the
 * child, because the arrow `child` runs captures nothing.
 *
 * @param arg handed to `f`: a number, `boolean` or `enum`, or memory the
 *   parent's root reaches, which `f` may store into the child, a string read
 *   off the root included. Memory the entered function allocated, and a string
 *   the root does not reach, are refused when `f` stores them (NL2610).
 * @param f builds the child's root from `arg`, under the same rules as
 *   `child`'s.
 * @returns the handle to the child, which holds its memory until `free` of it
 *   or of its parent.
 */
export const childWith = <A, T>(arg: A, f: (arg: A) => T): Region<T> => {
  const h: i64 = childNew()
  open(h)
  return close(h, f(arg))
}

/**
 * Give the region's memory back. The handle is dead after it. The compiler
 * writes the body.
 *
 * @param _r the region to free, with every child made under it. It, its
 *   children and every copy of their handles are dead after this; freeing it
 *   again, or while it or a child is entered, stops the program rather than
 *   freeing twice.
 */
export const free = <T>(_r: Region<T>): void => {
  // `nish_region_free`: see above.
}
