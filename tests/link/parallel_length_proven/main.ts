// A `parallelMapInto` length check the caller proves (docs/LANGUAGE.md,
// "Panic sites"). The call checks that `dst` is at least as long as `src`
// before it divides the work, so it is a `parallel-length` site of its caller,
// proven by `src.length <= dst.length` holding where it runs: here by the
// early return in `guarded`, and in `main` by mapping `src` in place. Both
// sites are listed as proven, and
// `--deny-panics` (`args`) builds this package. `parallel_length_unproven` is
// the call unguarded.
import { parallelMapInto } from "nish/threads"

const low = (x: i32): i32 => x & 255

const guarded = (src: i32[], dst: i32[]): void => {
  if (dst.length < src.length) {
    return
  }
  parallelMapInto(src, dst, low)
}

export const main = (): i32 => {
  const src: i32[] = [256, 257, 258]
  const dst: i32[] = [0, 0, 0, 0]
  guarded(src, dst)
  parallelMapInto(src, src, low)
  for (const x of dst) {
    console.log(x)
  }
  for (const x of src) {
    console.log(x)
  }
  return 0
}
