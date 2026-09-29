import { reading, Sample } from "./types";

const sum = (data: u8[]): i32 => {
  let total = 0;
  for (const b of data) {
    total = total + toI32(b);
  }
  return total;
};

const valueOf = (r: Sample | null): i32 => (r === null ? 0 : r.value);

const parsed = (n: i32): Result<i32, string> => (n < 0 ? Err("negative") : Ok(n));

export const main = (): number => {
  const data: u8[] = [toU8(1), toU8(2), toU8(3)];
  const r: Sample | null = reading(sum(data));
  const p: Result<i32, string> = parsed(valueOf(r) + valueOf(null));
  console.log(`${p.ok ? p.value : -1}`);
  return p.ok ? 0 : 1;
};
