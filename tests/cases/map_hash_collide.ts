// JSON-13 (docs/security/json.md): a `Map<string, V>` hashes its keys under
// the process's random key, so keys chosen to collide under an unkeyed hash
// land in buckets of their own. The 4096 keys here are every choice of one
// block from each of twelve pairs, and each pair's two blocks leave FNV-1a's
// 32-bit state equal, so all 4096 share one FNV-1a hash: under FNV-1a every
// insert compared its key with every key before it, 8,386,560 compares in all.
//
// `tests/run.js` links this with `-Wl,--wrap=nish_str_eq` and
// `map_hash_collide.c`, whose wrapper counts every key compare and answers the
// count through `mapKeyCompares`, and whose `mapHashSeed` answers the key's
// folded low word, so two runs can show the key is random.
declare function mapKeyCompares(): i32;
declare function mapHashSeed(): i32;

// The twelve pairs, six bytes a block, each pair's two blocks side by side.
const PAIRS: string =
  "qa107johrh1b3t9em1dbxqiymhfb80uw7c1rxwn7ayodl6y8" +
  "nwv3dcesnrvqu8oyzn9xvuv97h17matoyhjqbud1j64vee4v" +
  "u5rfkg7d1rtpoegxagm0vud5fl2roj5xhg5j6rr4dnzdngxw";

const keyOf = (m: i32): string => {
  const blocks: string[] = [];
  for (let i: i32 = 0; i < 12; i++) {
    const pick: i32 = 2 * i + ((m >> i) & 1);
    blocks.push(PAIRS.slice(6 * pick, 6 * pick + 6));
  }
  return blocks.join("");
};

export const main = (): i32 => {
  const n: i32 = 4096;
  const m = new Map<string, i32>();
  const before = mapKeyCompares();
  for (let i: i32 = 0; i < n; i++) {
    m.set(keyOf(i), i);
  }
  const afterInserts = mapKeyCompares();
  let hits: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    if ((m.get(keyOf(i)) ?? -1) === i) {
      hits++;
    }
  }
  const afterHits = mapKeyCompares();
  console.log(`size ${m.size}`);
  console.log(`inserts: ${afterInserts - before} key compares`);
  console.log(`hits ${hits}: ${afterHits - afterInserts} key compares`);
  console.log(`seed ${mapHashSeed()}`);
  return 0;
};
