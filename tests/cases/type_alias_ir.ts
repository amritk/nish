// A `type` alias emits nothing: an alias *is* the type it names, the way
// `Int32Array` is `i32[]`. This program and `type_alias_expanded.ts` differ
// only in whether the aliases are there, so their goldens are byte-identical
// files — which is the whole claim, checked as a diff.
type Byte = u8;
type Small = Byte;
type Label = string;
type Bytes = Byte[];
type View = readonly i32[];
type Reading = Sample;
type MaybeReading = Sample | null;
type Parsed = Result<i32, Label>;

class Sample {
  value: i32 = 0;
  name: Label = "";
}

function widen(b: Small): i32 {
  return toI32(b);
}

function sum(data: Bytes): i32 {
  let total = 0;
  for (const b of data) {
    total = total + widen(b);
  }
  return total;
}

function first(view: View): i32 {
  return view.length > 0 ? view[0] : 0;
}

function labelOf(r: MaybeReading): Label {
  if (r === null) {
    return "none";
  }
  return r.name;
}

function reading(value: i32): Reading {
  const s: Reading = new Sample();
  s.value = value;
  s.name = "sample";
  return s;
}

function parsed(n: i32): Parsed {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function test(): number {
  const data: Bytes = [toU8(1), toU8(2), toU8(3)];
  const view: View = [10, 20];
  const r: Reading = reading(sum(data));
  console.log(labelOf(r));
  console.log(labelOf(null));
  const p: Parsed = parsed(first(view));
  return p.ok ? p.value + r.value : -1;
}
