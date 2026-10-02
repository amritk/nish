// A file of 2^31 + 16 bytes is unreadable rather than read: no string or array
// may be longer than 2^31 - 1, because under the default `--number-mode i32`
// its `length` reads back negative, -2147483632 here, and `lastOf` then read
// `xs[-2147483633]` with no bounds check (a SIGSEGV). The file is sparse, made
// by `dd` with a seek and no data, so it costs no disk.
// docs/security/runtime.md, RT-1; docs/security/codegen.md, CG-3.
import { lastOf } from "./lib";

export const main = (): number => {
  mkdirSync("build");
  mkdirSync("build/rt_sec_read_cap");
  const path = "build/rt_sec_read_cap/big.bin";
  const made = spawnSyncTo(
    ["dd", "if=/dev/null", `of=${path}`, "bs=1", "count=0", "seek=2147483664"],
    "build/rt_sec_read_cap/dd.out",
    "build/rt_sec_read_cap/dd.err"
  );
  if (made !== 0) {
    console.log(`dd failed: ${made}`);
    return 2;
  }
  const bytes = readFileBytesSync(path);
  console.log(bytes === null ? "readFileBytesSync: null" : `readFileBytesSync: ${bytes.length} ${lastOf(bytes)}`);
  const text = readFileSyncOrNull(path);
  console.log(text === null ? "readFileSyncOrNull: null" : `readFileSyncOrNull: ${text.length}`);
  // Last, because it is the reader that exits: `nish: cannot read <path>`, 1.
  const sure = readFileSync(path);
  console.log(`readFileSync: ${sure.length}`);
  return 0;
};
