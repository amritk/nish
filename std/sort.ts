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
 * **Shape.** Runs of `RUN` are sorted by insertion, then merged bottom-up,
 * alternating between the array and one scratch array of the same length, and
 * copied back once if the last pass ended in the scratch. Every merge takes
 * from the left run on a tie, which is what makes it stable.
 */

/** The length of the runs insertion sort makes before the first merge. */
const RUN: i32 = 16

/** `xs[lo..hi)` sorted in place by insertion. */
const insertionRun = <T>(xs: T[], cmp: (a: T, b: T) => number, lo: i32, hi: i32): void => {
  for (let i: i32 = lo + 1; i >= 0 && i < hi && i < toI32(xs.length); i++) {
    const v = xs[i]
    let j = i
    while (j > lo && j > 0 && j < toI32(xs.length) && cmp(xs[j - 1], v) > 0) {
      if (j > 0 && j < toI32(xs.length)) {
        xs[j] = xs[j - 1]
      }
      j = j - 1
    }
    if (j >= 0 && j < toI32(xs.length)) {
      xs[j] = v
    }
  }
}

/** The sorted runs `src[lo..mid)` and `src[mid..hi)` merged into `dst[lo..hi)`. */
const mergeRuns = <T>(src: T[], dst: T[], cmp: (a: T, b: T) => number, lo: i32, mid: i32, hi: i32): void => {
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
      j = j + 1
    } else {
      if (i >= 0 && i < toI32(src.length) && k < toI32(dst.length)) {
        dst[k] = src[i]
      }
      i = i + 1
    }
  }
}

/** One bottom-up pass: every pair of adjacent `width`-runs of `src` merged into `dst`. */
const mergePass = <T>(src: T[], dst: T[], cmp: (a: T, b: T) => number, n: i32, width: i32): void => {
  for (let lo: i32 = 0; lo < n; lo = lo + 2 * width) {
    const mid = lo + width < n ? lo + width : n
    const hi = mid + width < n ? mid + width : n
    mergeRuns(src, dst, cmp, lo, mid, hi)
  }
}

/** `xs` sorted in place by `cmp`, stably, and answered: what `xs.sort(cmp)` compiles to. */
export const sortWith = <T>(xs: T[], cmp: (a: T, b: T) => number): T[] => {
  const n: i32 = toI32(xs.length)
  if (n < 2) {
    return xs
  }
  for (let lo: i32 = 0; lo < n; lo = lo + RUN) {
    insertionRun(xs, cmp, lo, lo + RUN < n ? lo + RUN : n)
  }
  if (n <= RUN) {
    return xs
  }
  const tmp: T[] = []
  for (const x of xs) {
    tmp.push(x)
  }
  let inTmp = false
  for (let width: i32 = RUN; width < n; width = width * 2) {
    if (inTmp) {
      mergePass(tmp, xs, cmp, n, width)
    } else {
      mergePass(xs, tmp, cmp, n, width)
    }
    inTmp = !inTmp
  }
  if (inTmp) {
    for (let k: i32 = 0; k < n && k < toI32(xs.length) && k < toI32(tmp.length); k++) {
      xs[k] = tmp[k]
    }
  }
  return xs
}
