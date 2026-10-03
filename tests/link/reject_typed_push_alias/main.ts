// #347: a return type or a field spelled through another module's `type`
// alias carries the typed-array name, though this module never imports the
// alias, because the declaring module reads the spelling where its aliases are.
import { make, Recorder, rows } from "./samples";

export const main = (): number => {
  make(2).pop();
  const rec = new Recorder();
  rec.data.push(rec.data[0]);
  rec.latest().pop();
  rows()[0].pop();
  return 0;
};
