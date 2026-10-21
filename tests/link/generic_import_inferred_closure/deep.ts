// Two levels down: a member's own member.
import { deep } from "./lib";

export const viaDeep = <T>(v: T): i32 => {
  const d = deep(9);
  return d.w.b.get();
};
