// `realpathSync` (WP19 §5a item 4): the one path resolution the language has,
// and the one a compiler needs to find the package it was installed in when
// `argv[0]` reached it through a symbolic link — `ln -s /opt/nish/bin/nish
// /usr/local/bin/nish` is how a binary ordinarily reaches `$PATH`, and npm
// links every command the same way.
//
// The three answers here are the contract, and none of them is a path: an
// absolute answer is whatever machine this runs on, so what is pinned is the
// shape rather than the bytes. `tests/run.js` resolves an actual symlink in a
// directory it makes, which is the half a golden cannot state portably.
//
// The middle one is why the result is `string | null` rather than a string
// that is empty when nothing resolves: "does not resolve" is an answer the
// caller asked for, and every component but the last has to exist for POSIX
// `realpath` to answer at all.
export function main(): number {
  const missing = realpathSync("no-such-path-9f3c1a");
  console.log(`missing: ${missing === null ? "<null>" : "<resolved>"}`);
  const here = realpathSync(".");
  console.log(`dot: ${here === null ? "<null>" : here.startsWith("/") ? "absolute" : "relative"}`);
  // The narrowing is an ordinary `T | null` one: inside the guard the value is
  // a `string` and carries string methods, with no cast anywhere.
  if (here !== null) {
    console.log(`nonempty: ${here.length > 0}`);
  }
  return 0;
}
