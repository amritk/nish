import { Bytes, MaybeReading, Parsed, reading } from "./types";

const sum = (data: Bytes): i32 => {
  let total = 0;
  for (const b of data) {
    total = total + toI32(b);
  }
  return total;
};

const valueOf = (r: MaybeReading): i32 => (r === null ? 0 : r.value);

const parsed = (n: i32): Parsed => (n < 0 ? Err("negative") : Ok(n));

export const main = (): number => {
  const data: Bytes = [toU8(1), toU8(2), toU8(3)];
  const r: MaybeReading = reading(sum(data));
  const p: Parsed = parsed(valueOf(r) + valueOf(null));
  console.log(`${p.ok ? p.value : -1}`);
  return p.ok ? 0 : 1;
};
