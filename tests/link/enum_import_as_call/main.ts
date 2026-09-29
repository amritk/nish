// An imported enum is a type, not a function: there is no conversion to call,
// imported or not.
import { Kind } from "./kinds";

export const main = (): number => {
  const k = Kind(2);
  return 0;
};
