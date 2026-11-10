// --deterministic refuses `env` (NL2701): the environment differs from host to host.
export const main = (): number => {
  console.log(getenv("HOME") === null);
  return 0;
};
