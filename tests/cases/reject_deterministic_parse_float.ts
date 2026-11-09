// --deterministic refuses `parseFloat` (NL2697) for the reason it refuses `Number`.
export const main = (): number => {
  console.log(parseFloat("0x10"));
  return 0;
};
