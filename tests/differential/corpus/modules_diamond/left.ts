import { base, twice } from "./common";

export const leftValue = (): number => {
  return twice(base()) + 1;
};
