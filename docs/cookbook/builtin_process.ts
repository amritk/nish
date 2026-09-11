export const main = (): number => {
  if (!mkdirSync("build/out")) {
    panic("cannot create build/out");
  }
  const argv: string[] = ["bash", "scripts/build.sh", "app.ll"];
  return spawnSync(argv);
};
