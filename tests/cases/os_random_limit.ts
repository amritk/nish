// WP34 N3: one call fills at most 65,536 bytes, the Web API's limit, and more
// is a panic natively and under runtime/nish.mjs alike (where Node's own
// method would throw a `QuotaExceededError`). The `os_` block of tests/run.js
// holds both runs to the line before it and to exit 1.
export const main = (): i32 => {
  const most = new Array<u8>(65536);
  crypto.getRandomValues(most);
  console.log("65536 filled");
  const over = new Array<u8>(65537);
  crypto.getRandomValues(over);
  console.log("not reached");
  return 0;
};
