// An **empty** path leaves that stream inherited, and the `inherited` line is the
// proof: the child writes it to this process's own stdout, so it lands in this
// golden between two lines this program printed.
//
// The two failures are `spawnSync`'s, for the same reasons: an empty vector has
// no argv[0] to run, and a program that is not on `PATH` cannot be started.
export const main = (): number => {
  mkdirSync("build");
  const err = "build/io_spawn_to_inherit.err";
  console.log("before");
  console.log(`status: ${spawnSyncTo(["sh", "-c", "echo inherited"], "", err)}`);
  const empty: string[] = [];
  console.log(`empty: ${spawnSyncTo(empty, "", err)}`);
  console.log(`missing: ${spawnSyncTo(["nish-no-such-program"], "", err)}`);
  return 0;
};
