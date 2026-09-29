// An imported enum converts to `i32` no more than a local one does.
import { Kind } from "./kinds";

export const main = (): number => {
  const n: i32 = Kind.B;
  return n;
};
