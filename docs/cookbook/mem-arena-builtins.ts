const measure = (): i64 => {
  const m = Arena.mark();
  const xs = new Array<number>(2000); // 8000 bytes: over the 4096-byte stack cap, so arena
  const used = Arena.used();
  Arena.release(m);
  return used + toI64(xs.length);
};

const recycle = (): void => {
  Arena.reset();
};
