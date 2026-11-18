// The host module of the NL3049 case: a regular expression the reader cannot skip.
import type { i32 } from "nish"
export const digits = (): i32 => {
  return /[0-9]+/.exec("a12")?.length ?? 0
};
