// With `alias_export_ir_local`, one program written twice: here `main.ts`
// imports its types through aliases, there it spells out what they name, and
// `main.ll` is the same file in both. An alias emits nothing, so whether one
// is written, and where, cannot move a byte.
export class Sample {
  value: i32 = 0;
}

export type Reading = Sample;
export type MaybeReading = Sample | null;
export type Bytes = u8[];
export type Parsed = Result<i32, string>;

export const reading = (value: i32): Reading => {
  const s = new Sample();
  s.value = value;
  return s;
};
