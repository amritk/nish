// The four `Result` shapes the interop generators have to spell (WP17).
// `half` and `checkPort` are small enough to travel in a register, so the C
// header returns them by value as `sts_result_..._word`; `describe` takes one
// the same way, because the packing is symmetric; `openFile` carries a struct
// in its error arm and stays the arena pointer WP16 has always used.
// This case is compiled with `--emit-header`, `--emit-napi` and `--emit-dts` in
// the WP17 interop block of tests/run.js, and a C driver calls all four.
interface IoError {
  code: i32;
  path: string;
}

export function half(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

export function checkPort(port: i32): Result<void, i32> {
  if (port <= 0) {
    return Err(port);
  }
  return Ok();
}

export function openFile(path: string): Result<i32, IoError> {
  if (path === "") {
    const problem: IoError = { code: 2, path: path };
    return Err(problem);
  }
  return Ok(3);
}

export function describe(r: Result<i32, i32>): i32 {
  if (r.isErr()) {
    return -r.error;
  }
  return r.value;
}
