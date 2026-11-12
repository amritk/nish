// WP27 S4.2: `readStruct(p)` copies the C struct at `p` into a new instance of
// the `declare class` its context names, so the copy is the program's and C's
// struct is C's. `ffi_struct_read.c` holds `sample`, a static struct, and
// `overwriteSample` rewrites every field of it; each copy below is read after
// that write and after `churn` has filled the arena with other structs, so a
// view of C's bytes, or a copy whose scope had been released, would print the
// new values or the churn's. `name` is still C's pointer in the copy, a static
// string C does not move. `localeconv` is libc's: the first two fields of
// `struct lconv` are a prefix of it, which is all `readStruct` reads.
import { readCString, readStruct } from "nish:unsafe";

declare class Sample {
  tag: u8
  count: i64
  name: CPtr
  ratio: f64
}

declare class Lconv {
  decimalPoint: CPtr
  thousandsSep: CPtr
}

declare function samplePtr(): CPtr
declare function overwriteSample(): void
declare function localeconv(): CPtr

type Copy = Sample

// The copy is made in a function whose scope ends at its return.
const copied = (): Sample => readStruct(samplePtr())

const churn = (): i64 => {
  let total: i64 = 0
  for (let i = 0; i < 64; i++) {
    const s = new Sample()
    s.tag = 255
    s.count = 99
    s.ratio = 9.5
    total = total + s.count
  }
  return total
}

const show = (label: string, s: Sample): void => {
  console.log(`${label}: tag ${s.tag}, count ${s.count}, name ${readCString(s.name)}, ratio ${s.ratio}`)
}

export function run(): i32 {
  const kept = copied()
  const alias: Copy = readStruct(samplePtr())
  let maybe: Sample | null = null
  maybe = readStruct(samplePtr())
  console.log(`churned ${churn()}`)
  overwriteSample()
  show("kept", kept)
  show("alias", alias)
  if (maybe !== null) {
    show("nullable", maybe)
  }
  show("fresh", readStruct(samplePtr()))
  const lc: Lconv = readStruct(localeconv())
  console.log(`decimal point ${readCString(lc.decimalPoint)}, thousands separator "${readCString(lc.thousandsSep)}"`)
  return 0
}
