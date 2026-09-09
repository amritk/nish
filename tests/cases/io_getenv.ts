// `getenv` (WP19 §4): the one way to read the environment, because
// `process.env.NAME` is member access on a key that is a value, which Phase 0
// refuses. It answers `string | null` and is narrowed like any other nullable,
// so a program cannot read the value without first deciding what an unset
// variable means.
//
// The harness sets `AMRITC_TEST_ENV` and `AMRITC_TEST_EMPTY` for this case and
// unsets `AMRITC_TEST_MISSING`, so the output does not depend on the shell it
// was run from. The empty one is the case the nullable exists for: `FOO=` is
// set and answers "", where an unset variable answers null.
export function main(): number {
  const set = getenv("AMRITC_TEST_ENV");
  console.log(`set: ${set === null ? "<null>" : set}`);

  const empty = getenv("AMRITC_TEST_EMPTY");
  console.log(`empty: ${empty === null ? "<null>" : `"${empty}"`}`);

  const missing = getenv("AMRITC_TEST_MISSING");
  if (missing === null) {
    console.log("missing: <null>");
  } else {
    console.log(`missing: ${missing}`);
  }

  // Narrowing carries into the branch, so `.length` needs no second test.
  const path = getenv("AMRITC_TEST_ENV");
  console.log(`length: ${path === null ? -1 : path.length}`);
  return 0;
}
