// The whole command line is one `string[]`; there is no (program, args) form.
export const main = (): number => {
  return spawnSync("sh", ["-c", "exit 0"]);
};
