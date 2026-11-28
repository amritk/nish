// examples-strict S7e: `crypto.tryGetRandomValues(bytes)` is the twin of
// `crypto.getRandomValues` that answers whether it filled the buffer, where
// the original exits. Built with `--deny-panics`: the twin is no panic site,
// so a strict module may call it and hand the failure on as its own error.
// 65,536 bytes is filled; 65,537, past the Web API's limit for one call, is
// the failure arm, answered `false` where `getRandomValues` exits 1. The
// other arm, a source that fails, is the `os_` block of tests/run.js, which
// runs this program with `getrandom` answering EPERM.
const draw = (into: u8[]): Result<i32, string> => {
  if (!crypto.tryGetRandomValues(into)) {
    return Err("no entropy");
  }
  return Ok(into.length);
};

const report = (r: Result<i32, string>): void => {
  if (r.ok) {
    console.log(`filled ${r.value}`);
  } else {
    console.log(r.error);
  }
};

export const main = (): i32 => {
  const a = new Array<u8>(32);
  const b = new Array<u8>(32);
  report(draw(a));
  const filled = crypto.tryGetRandomValues(b);
  // Two 32-byte draws that agree would be a broken source (2^-256).
  let same = true;
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) {
      same = false;
    }
  }
  console.log(filled && !same);
  report(draw(new Array<u8>(0)));
  report(draw(new Array<u8>(65536)));
  report(draw(new Array<u8>(65537)));
  return 0;
};
