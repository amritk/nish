// WP15 §2.4, the build-mode rule: tests/link/range_export's program, built with
// `--emit-header`. A C host may include the header and call `Permute_swap` with
// any index, so `Permute.swap` keeps both of its bounds checks (`hostVisible`
// in `self/visibility.ts`, checked by `tests/run.js`).
import { Permute } from "../range_export/permute";

export const main = (): number => {
  const p = new Permute();
  console.log(`${p.innerBenchmarkLoop(3)}`);
  console.log(`${p.count}`);
  return 0;
};
