const half = (n: number): Result<number, string> => {
  if (n % 2 !== 0) {
    return Err("odd");
  }
  return Ok(n / 2);
};

const quarter = (n: number): Result<number, string> => {
  const h = half(n).orReturn();
  return half(h);
};

const describe = (n: number): string => {
  const outcome = quarter(n);
  if (outcome.isErr()) {
    return outcome.error;
  }
  return `${outcome.value}`;
};
