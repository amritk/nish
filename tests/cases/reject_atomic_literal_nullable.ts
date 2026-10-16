// An object literal under a nullable atomic type: the `| null` does not hide
// the class, so the literal is still refused.
import { AtomicI32 } from "nish/threads";
export const main = (): i32 => {
  const x: AtomicI32 | null = { value: 1 };
  return x === null ? 0 : x.load();
};
