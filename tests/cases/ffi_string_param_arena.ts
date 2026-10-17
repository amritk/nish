// WP27 S3.1: a string handed to C is borrowed for the length of the call. Here
// it is built in a function whose arena scope releases when it returns, after
// the call, so the bytes are live while `remember` (in
// `ffi_string_param_arena.c`) reads them and are reused afterwards. The C side
// allocates through the runtime before it reads, so a scope released before
// the call would hand it those bytes and the copy would read 'Z's; it copies
// what it read, `churn` then fills the released scope with other strings, and
// the driver prints the copy, which holds the bytes as they were during the
// call. `isNull` is the null arm run natively: `null` reaches C as NULL.
declare function remember(s: string): i32;
declare function isNull(s: string | null): i32;

const digits = (n: i32): string => `${n * 1000 + 7}`;

const handOver = (n: i32): i32 => {
  const label: string = "id-" + digits(n) + "-end";
  return remember(label);
};

const churn = (n: i32): i32 => {
  let total: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    const noise: string = "xxxxxxxxxxxxxxxx" + digits(i);
    total = total + toI32(noise.length);
  }
  return total;
};

const maybe = (n: i32): string | null => (n > 100 ? digits(n) : null);

export const run = (n: i32): i32 => {
  const read: i32 = handOver(n);
  const absent: i32 = isNull(maybe(n));
  const present: i32 = isNull(maybe(n * 10));
  return read + churn(64) + absent * 1000 + present * 100;
};
