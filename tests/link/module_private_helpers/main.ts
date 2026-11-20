import { down } from "./down";
import { up } from "./up";

// Three modules, each with its own private `step`: three symbols,
// `@up$.step`, `@down$.step` and `@main$.step` (WP57 S1).
const step = (n: number): number => {
  return n - 42;
};

export const main = (): number => {
  return step(up(down(49)));
};
