// `alias_export_ir/types.ts` with the aliases the other `main.ts` imports
// left out, so the two `types.ll` files are the same bytes as well.
export class Sample {
  value: i32 = 0;
}

export const reading = (value: i32): Sample => {
  const s = new Sample();
  s.value = value;
  return s;
};
