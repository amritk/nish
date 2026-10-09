// A `readdirSync` listing holds names the call allocated (CG-5), and so does
// an array a function returns it through, or anything a callee reads out of
// it. `listOf` returns the listing on, so a call of it is a listing too and
// the name `keep` takes from one outlives the pass that made it; `firstOf`
// is handed the listing and answers a name, which `pick` returns after its
// own scope would have released it; and `log.name` keeps a name read out of
// a listing in an object. Each name reads back intact after `churn` has
// reused every byte a wrong release would have freed.
class Log {
  name: string;

  constructor() {
    this.name = "";
  }
}

const dir: string = "build/mem_return_array_readdir";

const listOf = (d: string): string[] => {
  const names = readdirSync(d);
  if (names === null) {
    return [];
  }
  return names;
};

const firstOf = (names: string[]): string => names[0];

const pick = (d: string): string => {
  const names = readdirSync(d);
  if (names === null) {
    return "";
  }
  return firstOf(names);
};

export const main = (): void => {
  mkdirSync("build");
  mkdirSync(dir);
  writeFileSync(`${dir}/alpha_first_entry`, "a");
  const log = new Log();
  let keep = "";
  for (let i = 0; i < 3; i++) {
    keep = listOf(dir)[0];
  }
  for (let i = 0; i < 3; i++) {
    const names = readdirSync(dir);
    if (names !== null) {
      log.name = names[0];
    }
  }
  const picked = pick(dir);
  console.log(`${churn()}`);
  console.log(keep);
  console.log(log.name);
  console.log(picked);
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};
