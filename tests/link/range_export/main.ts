// WP15 §2.4, the build-mode rule: the AWFY Permute shape as an exported class
// in a multi-module executable. `tests/run.js` checks that `Permute.swap` in
// the emitted `permute.ll` carries no bounds check; the `range_export_*`
// programs beside this one build the same class in each host-facing mode, and
// each keeps both checks.
import { Permute } from "./permute";

export const main = (): number => {
  const p = new Permute();
  console.log(`${p.innerBenchmarkLoop(3)}`);
  console.log(`${p.count}`);
  return 0;
};
