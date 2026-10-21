// The member is held through a nullable field.
import { maybe } from "./lib";

export const viaNullable = <T>(v: T): i32 => {
  const m = maybe(9);
  const b = m.b;
  return b === null ? 0 : b.get();
};
