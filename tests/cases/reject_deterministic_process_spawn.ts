// --deterministic refuses `process.spawn` (NL3053): another program answers.
export const main = (): number => {
  console.log(spawnSync(["true"]));
  return 0;
};
