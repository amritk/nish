import { base, twice } from "./common";

export function leftValue(): number {
  return twice(base()) + 1;
}
