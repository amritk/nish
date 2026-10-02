// A name read out of a `readdirSync` listing is as new as the listing: the
// runtime bumped it in the same call. `first` returned one while its automatic
// arena scope released the listing, so the 373 bytes of `junk` were bumped over
// the name and `a` read them. The listing now flows through its elements, and
// `first` gets no scope. docs/security/codegen.md, finding CG-5.
const first = (d: string): string => {
  const names = readdirSync(d);
  if (names === null || names.length === 0) {
    return "none";
  }
  return names[0];
};

export const test = (): number => {
  mkdirSync("build");
  const dir = "build/cg_sec_readdir_return";
  mkdirSync(dir);
  writeFileSync(`${dir}/alpha_first_entry`, "a");
  writeFileSync(`${dir}/beta_second_entry`, "b");
  const a = first(dir);
  const q = "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ";
  const junk = `${q}${q}${q}${q}${q}${q}${parseInt("1")}`;
  console.log(a === "alpha_first_entry" ? "intact" : "corrupted");
  console.log(`${a.length} ${junk.length}`);
  return 0;
};
