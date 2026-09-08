// A fallible function in a tight loop: what `Result<T, E>` costs per call
// (WP16/WP17). `half` answers a `Result<number, number>` — two four-byte
// payloads, so the ABI returns it in one register — and `combine` takes one the
// same way, so a single iteration exercises both directions of the packing.
//
// The twins are result.c, whose `Result` is the eight-byte struct
// `--emit-header` declares for this type, and result.rs, whose `Result` Rust
// returns in a register for the same reason. All three should therefore be the
// same code; a StaticTS column well behind them means a `Result` went back to
// being a pointer into the arena.
//
// The accumulator feeds the next input, so the loop has a carried dependency
// and cannot be closed-formed or vectorised away, and everything is masked to
// 16 bits so no version relies on signed overflow.
function half(n: number): Result<number, number> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

function combine(r: Result<number, number>): number {
  if (r.isErr()) {
    return -1;
  }
  return r.value;
}

export function main(): number {
  const N = 200000000; // bench:n
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc = (acc + combine(half((i + acc) & 0xffff))) & 0xffff;
  }
  console.log(acc);
  return 0;
}
