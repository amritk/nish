// The member is held through a `Result` field.
import { res } from "./lib";

export const viaResult = <T>(v: T): i32 => {
  const m = res(9);
  const r = m.r;
  return r.ok ? r.value.get() : 0;
};
