// `getenv` (WP19 R1): the one environment read the language has, and the one a
// self-hosted driver needs to honour `CC` before it spawns `scripts/build.sh`.
//
// The three answers this pins are the whole contract, and the middle one is
// why the result is `string | null` rather than a string that is empty when
// nothing is set: `AMRITC_TEST_EMPTY=` is a variable that *is* set, and a
// driver that treats it as "unset, use the default" would be wrong. The values
// come from `io_getenv.env`, because the language has no `setenv` and a golden
// that read the developer's own environment would not be a golden.
export function main(): number {
  const set = getenv("AMRITC_TEST_VALUE");
  console.log(`set: ${set === null ? "<null>" : set}`);
  const empty = getenv("AMRITC_TEST_EMPTY");
  console.log(`empty: ${empty === null ? "<null>" : `"${empty}"`}`);
  const unset = getenv("AMRITC_TEST_NOT_SET");
  console.log(`unset: ${unset === null ? "<null>" : unset}`);
  // The narrowing is an ordinary `T | null` one: inside the guard the value is
  // a `string` and carries string methods, with no cast anywhere.
  if (set !== null) {
    console.log(`length: ${set.length}`);
  }
  return 0;
}
