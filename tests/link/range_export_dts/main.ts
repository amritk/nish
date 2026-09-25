// WP15 §2.4, the build-mode rule: tests/link/range_export's program, built with
// `--emit-dts`. The declarations and their loader describe the exports to a
// wasm host, which may call them with any index, so `Permute.swap` keeps both
// of its bounds checks (`hostVisible` in `self/visibility.ts`, checked by
// `tests/run.js`).
import { Permute } from "../range_export/permute";

export const main = (): number => {
  const p = new Permute();
  console.log(`${p.innerBenchmarkLoop(3)}`);
  console.log(`${p.count}`);
  return 0;
};
