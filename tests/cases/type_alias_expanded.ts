// `type_alias_ir.ts` with every alias written out. The two goldens are the
// same bytes, which is what "an alias is not a distinct type" means: the
// aliases exist for the reader and reach neither the checker's types nor the
// IR. If this golden and `type_alias_ir.ll` ever differ, an alias has started
// to mean something.
class Sample {
  value: i32 = 0;
  name: string = "";
}

function widen(b: u8): i32 {
  return toI32(b);
}

function sum(data: u8[]): i32 {
  let total = 0;
  for (const b of data) {
    total = total + widen(b);
  }
  return total;
}

function first(view: readonly i32[]): i32 {
  return view.length > 0 ? view[0] : 0;
}

function labelOf(r: Sample | null): string {
  if (r === null) {
    return "none";
  }
  return r.name;
}

function reading(value: i32): Sample {
  const s: Sample = new Sample();
  s.value = value;
  s.name = "sample";
  return s;
}

function parsed(n: i32): Result<i32, string> {
  if (n < 0) {
    return Err("negative");
  }
  return Ok(n);
}

export function test(): number {
  const data: u8[] = [toU8(1), toU8(2), toU8(3)];
  const view: readonly i32[] = [10, 20];
  const r: Sample = reading(sum(data));
  console.log(labelOf(r));
  console.log(labelOf(null));
  const p: Result<i32, string> = parsed(first(view));
  return p.ok ? p.value + r.value : -1;
}
