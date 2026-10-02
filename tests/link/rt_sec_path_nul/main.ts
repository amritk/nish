// A path, a name or an argument that holds a NUL names nothing. The kernel
// reads a C string up to its first NUL, so before this every call below
// answered for the part in front of it: the README read, a directory found and
// listed, `PATH` read, and `true` run. docs/security/runtime.md, RT-3.
import { withNul } from "./lib";

export const main = (): number => {
  const readme = withNul("README.md", ".txt");
  console.log(`endsWith .txt: ${readme.endsWith(".txt")}`);
  const text = readFileSyncOrNull(readme);
  console.log(`readFileSyncOrNull: ${text === null ? "null" : "read"}`);
  const bytes = readFileBytesSync(readme);
  console.log(`readFileBytesSync: ${bytes === null ? "null" : "read"}`);
  const dir = withNul("tests", "x");
  console.log(`isDirectorySync: ${isDirectorySync(dir)}`);
  const listing = readdirSync(dir);
  console.log(`readdirSync: ${listing === null ? "null" : "listed"}`);
  const resolved = realpathSync(dir);
  console.log(`realpathSync: ${resolved === null ? "null" : "resolved"}`);
  const value = getenv(withNul("PATH", "X"));
  console.log(`getenv: ${value === null ? "null" : "read"}`);
  console.log(`spawnSync: ${spawnSync([withNul("true", "x")])}`);
  console.log(`spawnSync argument: ${spawnSync(["true", withNul("a", "b")])}`);
  console.log(`spawnSync plain: ${spawnSync(["true"])}`);
  return 0;
};
