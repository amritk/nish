// #386: the RT-9 primitives as builtins. `lstatOwnerModeSync(path)` is one
// `lstat`: the owner's uid in the high 32 bits and `st_mode` in the low 32, or
// -1 when the path does not resolve or holds a NUL. `geteuid()` is the uid to
// compare that owner with, and `isExecutableSync(path)` is `access(X_OK)`.
// The file is made here, so its owner is this process's effective uid on any
// machine, whoever owns the checkout. That a symbolic link answers for itself
// is RT-9 in tests/runtime-test.c, since the language cannot make one. The
// `i64`s are compared with `toI64` so that the source reads the same under
// `runtime/nish.mjs`, where an `i64` is a BigInt.
// The owner is masked after the shift: a uid of 2^31 or more fills bit 63,
// which `>>` copies down, and a BigInt has no `>>>`.
const ownerOf = (ownerMode: i64): i64 => (ownerMode >> toI64(32)) & ((toI64(1) << toI64(32)) - toI64(1));
const typeOf = (ownerMode: i64): i64 => ownerMode & toI64(0xf000);

export const main = (): i32 => {
  mkdirSync("build");
  mkdirSync("build/test");
  const file = "build/test/owner_checks.txt";
  writeFileSync(file, "x");
  const me = geteuid();
  console.log(me >= toI64(0));
  const om = lstatOwnerModeSync(file);
  console.log(om !== toI64(-1));
  console.log(ownerOf(om) === me);
  // S_IFREG and S_IFDIR: a regular file, then a directory.
  console.log(typeOf(om) === toI64(0x8000));
  console.log(typeOf(lstatOwnerModeSync("build/test")) === toI64(0x4000));
  // A uid with bit 31 set, packed as `nish_lstat_owner_mode` packs it, needs
  // no such user to exist: its owner unpacks to the uid, not a negative one.
  const highUid = toI64(1) << toI64(31);
  console.log(ownerOf((highUid << toI64(32)) | toI64(0x81a4)) === highUid);
  // Nothing there, and a path that names nothing because it holds a NUL.
  console.log(lstatOwnerModeSync("build/test/owner_checks.missing"));
  console.log(lstatOwnerModeSync("build/test/owner_checks.txt\0x"));
  // `writeFileSync` makes 0644, which no user may run, root included.
  console.log(isExecutableSync(file));
  console.log(isExecutableSync("/bin/sh"));
  console.log(isExecutableSync("/bin/sh\0x"));
  console.log(isExecutableSync("build/test/owner_checks.missing"));
  return 0;
};
