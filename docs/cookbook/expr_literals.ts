function literals(): f64 {
  const big: i64 = 3000000000;
  const ratio: f64 = 0.1;
  const scaled = ratio * 2;
  return scaled + toF64(big);
}
