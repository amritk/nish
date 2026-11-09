// --deterministic refuses `tty` (NL2699): the terminal differs from host to host.
export const main = (): number => {
  console.log(terminalSize()[0]);
  return 0;
};
