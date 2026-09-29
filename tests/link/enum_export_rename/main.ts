// `import { Kind as Level }`: the local name is the importer's, and the type
// and its members are still the exporter's, so a `Level` passes where
// `kinds.ts` declared a `Kind` and `Level.High` folds to its integer, 7.
import { Kind as Level, isHigh } from "./kinds";

const raise = (l: Level): Level => (l === Level.Low ? Level.High : l);

export const main = (): number => {
  const l: Level = raise(Level.Low);
  console.log(isHigh(l) ? "high" : "low");
  return l === Level.High ? 0 : 1;
};
