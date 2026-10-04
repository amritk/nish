// An allowlist refuses what it does not list (NL2459): `--allow clock` and a
// `main` that also reaches `exit`.
const stop = (code: i32): void => {
  process.exit(code);
};

export const main = (): number => {
  if (Date.now() < 0) {
    stop(3);
  }
  return 0;
};
