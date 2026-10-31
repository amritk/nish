/**
 * `std/sort` — `xs.sort(cmp)` on an array, in Nish: a stable merge sort,
 * compiled once per comparator.
 *
 * A program does not import this module. A `.sort(cmp)` call is what loads it
 * (the checker's `importSort`), and the checker routes the call to `sortWith`
 * here. `cmp` is a compile-time function parameter, so each comparator is an
 * instantiation of its own whose body calls the comparator directly — there is
 * no function pointer. Under Node and `tsc` the call is the platform's
 * `Array.prototype.sort`, so nothing here runs there.
 *
 * **Same order as Node.** `Array.prototype.sort` is stable (ES2019), so for a
 * comparator that is a consistent total preorder there is exactly one answer,
 * and any stable sort gives it. A comparator's result is read only as "greater
 * than zero or not": a later element moves before an earlier one only when
 * the comparator answers a positive number for (earlier, later), so a negative
 * zero and NaN are zero, as Node treats them.
 *
 * **Shape.** The array is copied once into a scratch array of the same
 * length, the only allocation, which the function's arena scope gives back
 * before it returns, so a sort leaves `Arena.used()` where it was. Runs of
 * `RUN` are sorted by insertion from the scratch into the array (a strictly
 * descending run is copied reversed instead), then merged
 * bottom-up, alternating between the two, and copied back once if the last
 * pass ended in the scratch. A pair of runs already in order is copied without
 * a merge. Every merge takes from the left run on a tie, which is what makes
 * it stable.
 *
 * **No element is held across a write.** An `interface` element is stored
 * inline, and `const v = xs[i]` is a pointer into the array, so an insertion
 * sort in place would overwrite the element it is inserting. Every step here
 * reads from one array and writes the other, and moves a whole slot, which for
 * an inline record is one copy of its bytes.
 *
 * **Proofs.** Every index is proven in range by the guard written beside it,
 * so no access keeps its bounds check. The run arithmetic wraps only where
 * the operands are proven to lie in `0..n`, so it cannot wrap: a difference
 * of two of them, or a sum taken only when it stays below `n`.
 */

import { wrappingAdd, wrappingSub } from "nish:unsafe"

/** The length of the runs insertion sort makes before the first merge. */
const RUN: i32 = 32

/**
 * `lo + step`, or `n` when that is not below `n`. Every caller has
 * `0 <= lo <= n`, so `n - lo` cannot wrap, and the sum is taken only below `n`.
 */
const stepTo = (lo: i32, step: i32, n: i32): i32 => (wrappingSub(n, lo) > step ? wrappingAdd(lo, step) : n)

/**
 * `src[lo..hi)` sorted by insertion into `dst[lo..hi)`. The comparator call
 * forgets every array length, so each access after it repeats its guard.
 */
const insertionRun = <T>(src: T[], dst: T[], cmp: (a: T, b: T) => number, lo: i32, hi: i32): void => {
  // A strictly descending run is copied reversed: no two of its elements are
  // equal, so reversing it keeps the sort stable, and costs one comparison each.
  // `lo < hi`, and `d` steps only while below `hi`, so neither `+ 1` wraps.
  let d = wrappingAdd(lo, 1)
  while (d > 0 && d < hi && d < toI32(src.length)) {
    const p = d - 1
    if (!(cmp(src[p], src[d]) > 0)) {
      break
    }
    d = wrappingAdd(d, 1)
  }
  if (d >= hi) {
    // `hi > lo >= 0`, so `hi - 1` does not wrap, and `r` steps down only from `r >= 0`.
    let r = wrappingSub(hi, 1)
    for (let k: i32 = lo; k >= 0 && k < hi && k < toI32(dst.length) && r >= 0 && r < toI32(src.length); k++) {
      dst[k] = src[r]
      r = wrappingSub(r, 1)
    }
    return
  }
  for (let i: i32 = lo; i >= 0 && i < hi; i++) {
    let j = i
    while (j > lo && j > 0 && j < toI32(dst.length) && i < toI32(src.length)) {
      const k = j - 1
      if (!(cmp(dst[k], src[i]) > 0) || k < 0 || k >= toI32(dst.length) || j >= toI32(dst.length)) {
        break
      }
      dst[j] = dst[k]
      j = k
    }
    if (i < toI32(src.length) && j >= 0 && j < toI32(dst.length)) {
      dst[j] = src[i]
    }
  }
}

/** `src[lo..hi)` copied into `dst[lo..hi)`. */
const copyRun = <T>(src: T[], dst: T[], lo: i32, hi: i32): void => {
  for (let k: i32 = lo; k >= 0 && k < hi && k < toI32(src.length) && k < toI32(dst.length); k++) {
    dst[k] = src[k]
  }
}

/**
 * The sorted runs `src[lo..mid)` and `src[mid..hi)` merged into `dst[lo..hi)`,
 * or copied when the last of the left run is not after the first of the right.
 */
const mergeRuns = <T>(src: T[], dst: T[], cmp: (a: T, b: T) => number, lo: i32, mid: i32, hi: i32): void => {
  if (mid > 0 && mid < hi && mid < toI32(src.length)) {
    const last = mid - 1
    if (last < toI32(src.length) && !(cmp(src[last], src[mid]) > 0)) {
      copyRun(src, dst, lo, hi)
      return
    }
  }
  let i = lo
  let j = mid
  for (let k: i32 = lo; k >= 0 && k < hi; k++) {
    let right = i >= mid
    if (!right && j < hi && i >= 0 && i < toI32(src.length) && j >= 0 && j < toI32(src.length)) {
      right = cmp(src[i], src[j]) > 0
    }
    if (right) {
      if (j >= 0 && j < toI32(src.length) && k < toI32(dst.length)) {
        dst[k] = src[j]
      }
      // `j` steps at most `hi - mid` times from `mid`, so it stays at most `hi`.
      j = wrappingAdd(j, 1)
    } else {
      if (i >= 0 && i < toI32(src.length) && k < toI32(dst.length)) {
        dst[k] = src[i]
      }
      // `i` steps at most `mid - lo` times from `lo`, so it stays at most `mid`.
      i = wrappingAdd(i, 1)
    }
  }
}

/** One bottom-up pass: every pair of adjacent `width`-runs of `src` merged into `dst`. */
const mergePass = <T>(src: T[], dst: T[], cmp: (a: T, b: T) => number, n: i32, width: i32): void => {
  let lo: i32 = 0
  while (lo >= 0 && lo < n) {
    const mid = stepTo(lo, width, n)
    const hi = stepTo(mid, width, n)
    mergeRuns(src, dst, cmp, lo, mid, hi)
    lo = hi
  }
}

/** `xs` sorted in place by `cmp`, stably, and answered: what `xs.sort(cmp)` compiles to. */
export const sortWith = <T>(xs: T[], cmp: (a: T, b: T) => number): T[] => {
  const n: i32 = toI32(xs.length)
  if (n < 2) {
    return xs
  }
  // One allocation at full size, every slot written before any is read: the
  // checker lets this `new Array<T>(n)` zero-fill any `T` (`isSortScratch`).
  const tmp = new Array<T>(n)
  copyRun(xs, tmp, 0, n)
  let lo: i32 = 0
  while (lo >= 0 && lo < n) {
    const hi = stepTo(lo, RUN, n)
    insertionRun(tmp, xs, cmp, lo, hi)
    lo = hi
  }
  let inTmp = false
  let width: i32 = RUN
  while (width > 0 && width < n) {
    if (inTmp) {
      mergePass(tmp, xs, cmp, n, width)
    } else {
      mergePass(xs, tmp, cmp, n, width)
    }
    inTmp = !inTmp
    width = stepTo(width, width, n)
  }
  if (inTmp) {
    copyRun(tmp, xs, 0, n)
  }
  return xs
}
