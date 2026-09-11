const half = (n: number): Result<number, number> => {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
};

const quarter = (n: number): Result<number, number> => {
  const h = half(n).orReturn();
  return half(h);
};

const describe = (n: number): number => {
  const outcome = quarter(n);
  if (outcome.isErr()) {
    return -outcome.error;
  }
  return outcome.value;
};
