// WP15 §2.4, the build-mode rule: tests/link/range_export's program, built with
// `--emit-napi-async` (which needs `--threads`). Node may call the class's
// methods from a worker with any index, so `Permute.swap` keeps both of its
// bounds checks (`hostVisible` in `self/visibility.ts`, checked by
// `tests/run.js`).
import { Permute } from "../range_export/permute";

export const main = (): number => {
  const p = new Permute();
  console.log(`${p.innerBenchmarkLoop(3)}`);
  console.log(`${p.count}`);
  return 0;
};
