// The member is held through an array field.
import { many } from "./lib";

export const viaArray = <T>(v: T): i32 => {
  const m = many(9);
  return m.bs[0].get();
};
