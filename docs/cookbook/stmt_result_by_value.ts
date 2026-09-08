function half(n: number): Result<number, number> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

function quarter(n: number): Result<number, number> {
  const h = half(n).orReturn();
  return half(h);
}

function describe(n: number): number {
  const outcome = quarter(n);
  if (outcome.isErr()) {
    return -outcome.error;
  }
  return outcome.value;
}
