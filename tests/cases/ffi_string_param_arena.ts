// WP27 S3.1: a string handed to C is borrowed for the length of the call. Here
// it is built in a function whose arena scope releases when it returns, after
// the call, so the bytes are live while `remember` (in
// `ffi_string_param_arena.c`) reads them and are reused afterwards. The C side
// copies what it read; `churn` then fills the released scope with other
// strings, and the driver prints the copy, which holds the bytes as they were
// during the call.
declare function remember(s: string): i32;

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

export const run = (n: i32): i32 => {
  const read: i32 = handOver(n);
  return read + churn(64);
};
