/**
 * `std/array` — the array methods that take a callback, and `slice`, in Nish:
 * each a plain loop, compiled once per callback.
 *
 *     export const main = (): i32 => {
 *       const xs: i32[] = [3, 1, 2];
 *       const doubled = xs.map((x) => x * 2); // [6, 2, 4]
 *       const big = xs.filter((x) => x > 1); // [3, 2]
 *       return doubled[0] + big.length + xs.findIndex((x) => x === 2); // 6 + 2 + 2
 *     };
 *
 * **A program does not need to import this module.** A `.map(...)`,
 * `.filter(...)`, `.some(...)`, `.every(...)`, `.findIndex(...)` or
 * `.slice(...)` call on an array is what loads it (the checker's
 * `importArrayMethods`), and the checker routes the call to the template here
 * that matches it: `xs.map(f)` is `map(xs, f)` when `f` takes one parameter
 * and `mapIndexed(xs, f)` when it takes two. `f` is a compile-time function
 * parameter, so each callback is an instantiation of its own whose body calls
 * it directly — there is no function pointer, and importing a template here
 * by name and calling it gives the same code as the method. Under Node,
 * `--emit-ts` leaves `map`, `filter`, `some`, `every` and `findIndex` as the
 * platform's own `Array.prototype` methods, writes `slice` as the runtime's
 * checked `sliceArray`, and copies an answer that holds records inline with
 * `copyRecords`, so nothing here runs there.
 *
 * **Same answers as Node.** Each walks the array from index 0 upward and
 * calls the callback once per element, in order, until the length it had when
 * the call began, as `Array.prototype` does; `some`, `every` and `findIndex`
 * stop at the first element that decides the answer. A callback that shrinks
 * the array ends the walk at the new length, where JavaScript goes on and
 * skips the missing indices.
 */

/**
 * The elements of `xs`, each passed through `f`, in a new array of the same
 * length: what `xs.map(f)` compiles to when `f` takes one parameter.
 *
 * @param xs the array read; it is not changed.
 * @param f called once per element, in order.
 * @returns a new array whose element `i` is `f(xs[i])`.
 */
export const map = <T, U>(xs: readonly T[], f: (x: T) => U): U[] => {
  const out: U[] = []
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    out.push(f(xs[i]))
  }
  return out
}

/**
 * The elements of `xs`, each passed through `f` with its index: what
 * `xs.map(f)` compiles to when `f` takes two parameters.
 *
 * @param xs the array read; it is not changed.
 * @param f called once per element, in order, with the element and its index.
 * @returns a new array whose element `i` is `f(xs[i], i)`.
 */
export const mapIndexed = <T, U>(xs: readonly T[], f: (x: T, i: number) => U): U[] => {
  const out: U[] = []
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    out.push(f(xs[i], i))
  }
  return out
}

/**
 * The elements of `xs` for which `pred` answers `true`, in order, in a new
 * array: what `xs.filter(pred)` compiles to when `pred` takes one parameter.
 *
 * @param xs the array read; it is not changed.
 * @param pred called once per element, in order.
 * @returns a new array of the elements kept.
 */
export const filter = <T>(xs: readonly T[], pred: (x: T) => boolean): T[] => {
  const out: T[] = []
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    const x = xs[i]
    if (pred(x)) {
      out.push(x)
    }
  }
  return out
}

/**
 * The elements of `xs` for which `pred` answers `true`, given each element and
 * its index: what `xs.filter(pred)` compiles to when `pred` takes two
 * parameters.
 *
 * @param xs the array read; it is not changed.
 * @param pred called once per element, in order, with the element and its index.
 * @returns a new array of the elements kept.
 */
export const filterIndexed = <T>(xs: readonly T[], pred: (x: T, i: number) => boolean): T[] => {
  const out: T[] = []
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    const x = xs[i]
    if (pred(x, i)) {
      out.push(x)
    }
  }
  return out
}

/**
 * Whether `pred` answers `true` for at least one element of `xs`, stopping at
 * the first that does: what `xs.some(pred)` compiles to when `pred` takes one
 * parameter. An empty array answers `false`.
 *
 * @param xs the array read; it is not changed.
 * @param pred called in order until it answers `true`.
 * @returns `true` when some element satisfies `pred`.
 */
export const some = <T>(xs: readonly T[], pred: (x: T) => boolean): boolean => {
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    if (pred(xs[i])) {
      return true
    }
  }
  return false
}

/**
 * Whether `pred` answers `true` for at least one element of `xs`, given each
 * element and its index: what `xs.some(pred)` compiles to when `pred` takes
 * two parameters.
 *
 * @param xs the array read; it is not changed.
 * @param pred called in order, with the element and its index, until it answers `true`.
 * @returns `true` when some element satisfies `pred`.
 */
export const someIndexed = <T>(xs: readonly T[], pred: (x: T, i: number) => boolean): boolean => {
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    if (pred(xs[i], i)) {
      return true
    }
  }
  return false
}

/**
 * Whether `pred` answers `true` for every element of `xs`, stopping at the
 * first that does not: what `xs.every(pred)` compiles to when `pred` takes one
 * parameter. An empty array answers `true`.
 *
 * @param xs the array read; it is not changed.
 * @param pred called in order until it answers `false`.
 * @returns `true` when no element fails `pred`.
 */
export const every = <T>(xs: readonly T[], pred: (x: T) => boolean): boolean => {
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    if (!pred(xs[i])) {
      return false
    }
  }
  return true
}

/**
 * Whether `pred` answers `true` for every element of `xs`, given each element
 * and its index: what `xs.every(pred)` compiles to when `pred` takes two
 * parameters.
 *
 * @param xs the array read; it is not changed.
 * @param pred called in order, with the element and its index, until it answers `false`.
 * @returns `true` when no element fails `pred`.
 */
export const everyIndexed = <T>(xs: readonly T[], pred: (x: T, i: number) => boolean): boolean => {
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    if (!pred(xs[i], i)) {
      return false
    }
  }
  return true
}

/**
 * The index of the first element of `xs` for which `pred` answers `true`:
 * what `xs.findIndex(pred)` compiles to when `pred` takes one parameter.
 *
 * @param xs the array read; it is not changed.
 * @param pred called in order until it answers `true`.
 * @returns the first such index, or `-1` when there is none.
 */
export const findIndex = <T>(xs: readonly T[], pred: (x: T) => boolean): number => {
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    if (pred(xs[i])) {
      return i
    }
  }
  return -1
}

/**
 * The index of the first element of `xs` for which `pred` answers `true`,
 * given each element and its index: what `xs.findIndex(pred)` compiles to when
 * `pred` takes two parameters.
 *
 * @param xs the array read; it is not changed.
 * @param pred called in order, with the element and its index, until it answers `true`.
 * @returns the first such index, or `-1` when there is none.
 */
export const findIndexIndexed = <T>(xs: readonly T[], pred: (x: T, i: number) => boolean): number => {
  const n = xs.length
  for (let i: number = 0; i < n && i < xs.length; i++) {
    if (pred(xs[i], i)) {
      return i
    }
  }
  return -1
}

/**
 * A copy of `xs[start..end)` in a new array: what `xs.slice(start, end)`
 * compiles to, with string `slice`'s rule. The range must satisfy
 * `0 <= start <= end <= xs.length`, and anything else panics with
 * `slice out of range: [start, end) of length n` and exits 1, where
 * JavaScript counts a negative end back from the length and clamps the rest.
 * A float bound is truncated toward zero and saturates (NaN to 0, an infinity
 * to the `i64` limit), natively and under Node alike.
 *
 * @param xs the array copied from; it is not changed.
 * @param start the first index copied.
 * @param end the index after the last copied.
 * @returns a new array of `end - start` elements.
 */
export const slice = <T>(xs: readonly T[], start: number, end: number): T[] => {
  const from = toI64(start)
  const to = toI64(end)
  const len = toI64(xs.length)
  if (from < 0 || from > to || to > len) {
    panic(`slice out of range: [${from}, ${to}) of length ${len}`)
  }
  const out: T[] = []
  for (let i: i32 = toI32(from); i >= 0 && i < toI32(to) && i < toI32(xs.length); i++) {
    out.push(xs[i])
  }
  return out
}

/**
 * A copy of `xs[start..)`: what `xs.slice(start)` compiles to. `start` must
 * satisfy `0 <= start <= xs.length`, or the call panics as `slice` does.
 *
 * @param xs the array copied from; it is not changed.
 * @param start the first index copied.
 * @returns a new array of the elements from `start` on.
 */
export const sliceFrom = <T>(xs: readonly T[], start: number): T[] => slice(xs, start, xs.length)

/**
 * A copy of the whole of `xs`: what `xs.slice()` compiles to.
 *
 * @param xs the array copied; it is not changed.
 * @returns a new array with the same elements.
 */
export const sliceAll = <T>(xs: readonly T[]): T[] => slice(xs, 0, xs.length)
