// WP21 S3: `getenv` has no runtime on a freestanding wasm32 build, and the
// program's own exported function reaches it, so the build is refused at the
// call rather than left to fail at the link (NL2404).
import { getenv } from "nish:process";

export const home = (): i32 => {
  const value = getenv("HOME");
  return value === null ? 0 : value.length;
};
