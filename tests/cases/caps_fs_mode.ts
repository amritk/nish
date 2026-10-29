// WP35: the three writers with a mode are `fs.write`, as `writeFileSync` is:
// `mkdirSyncMode` makes the private directory, `createFileExclusiveSync`
// takes the lock in it and `writeFileSyncMode` writes the secret beside it.
// The report names the first of them as `keep`'s witness.
const keep = (dir: string, secret: string): i32 => {
  mkdirSyncMode(dir, 0o700);
  if (createFileExclusiveSync(`${dir}/lock`, "", 0o600) < 0) {
    return 1;
  }
  const wrote = writeFileSyncMode(`${dir}/secret`, secret, 0o600);
  unlinkSync(`${dir}/lock`);
  return wrote < 0 ? 1 : 0;
};

export const main = (): number => {
  const done = keep("build/test/caps_fs_mode.d", "hunter2");
  console.log(`kept: ${done}`);
  return done;
};
