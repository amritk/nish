// NL8008: an i32 `>>>` reads back signed, where TypeScript reads it unsigned.
export const main = (): number => {
  const x: i32 = -8;
  return x >>> 0;
};
