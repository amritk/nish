// JSON-13 (docs/security/json.md): the string hash is SipHash-1-3, folded to
// 32 bits by XORing the halves. `useTestKey` sets the key to the bytes 00..0f,
// and each pair in `pairs` collides under that key in the reference SipHash-1-3 of
// `map_hash_kat.c`, which `referenceHash` answers. A lookup of the absent half
// of a pair finds the other half's stored hash equal and compares the keys
// once; a hash that strayed from the reference by one bit would compare none.
// Their lengths run from 5 to 23 bytes, so whole 8-byte words and 3, 5, 6 and
// 7 leftover bytes are all hashed.
//
// `tests/run.js` links this with `-Wl,--wrap=nish_str_eq` and
// `map_hash_kat.c`, whose wrapper counts every key compare.
declare function mapKeyCompares(): i32;
declare function useTestKey(): i32;
declare function referenceHash(s: string): u32;

export const main = (): i32 => {
  const pairs: string[] = [
    "2y0ea",
    "z7dnaa",
    "b7ylaaaa",
    "ozanaaaa",
    "74uiaaaaaaaaaaaa",
    "5efjaaaaaaa",
    "l2ccaaaaaaaaaaaaaaaaaaa",
    "hxkkaaa",
  ];
  console.log(`reference SipHash-2-4 vector ${useTestKey() === 1 ? "matches" : "differs"}`);
  for (let i: i32 = 0; i + 1 < pairs.length; i += 2) {
    const stored = pairs[i];
    const absent = pairs[i + 1];
    const m = new Map<string, i32>();
    m.set(stored, i);
    const before = mapKeyCompares();
    const found = m.get(absent) ?? -1;
    const compares = mapKeyCompares() - before;
    console.log(`${stored} ${referenceHash(stored)}, ${absent} ${referenceHash(absent)}: ${found}, ${compares} key compare`);
  }
  return 0;
};
