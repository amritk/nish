// The per-pass arena scope of a loop assumed a pointer read out of memory was
// older than the pass. An element of a `readdirSync` listing made in the pass is
// not: keeping one in an outer local and rewinding the pass let the next pass's
// strings overwrite it. docs/security/codegen.md, finding CG-5.
export const main = (): number => {
  mkdirSync("build");
  const dir = "build/cg_sec_readdir_pass";
  mkdirSync(dir);
  writeFileSync(`${dir}/alpha_first_entry`, "a");
  let keep = "unset";
  for (let i = 0; i < 3; i++) {
    const pad = i === 0 ? "" : "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ";
    const junk = `${pad}${i}`;
    const names = readdirSync(dir);
    if (names !== null && i === 0) {
      keep = names[0];
    }
    if (junk.length === 1000) {
      console.log("never");
    }
  }
  console.log(`${keep.length}`);
  console.log(keep === "alpha_first_entry" ? "intact" : "corrupted");
  return 0;
};
