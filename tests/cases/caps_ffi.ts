// WP35: a call to a `declare function` is `ffi`. The chain ends at the call,
// named by the declaration as written, because the body is C and nothing can
// be seen past it. `labs` is libc's, so the round trip links with nothing else.
declare function labs(n: i64): i64;

const magnitude = (n: i64): i64 => labs(n);

export const main = (): number => {
  const n: i64 = -9;
  console.log(magnitude(n));
  return 0;
};
