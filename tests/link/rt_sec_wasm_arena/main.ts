// The wasm runtime traps on a request that cannot fit wasm32's address space,
// where it used to hand back memory it did not have: a wrapped offset, a page
// count truncated to 32 bits, a wrapped array size, and an array grown past
// 2^31 - 1 elements. `probe.c` holds the four requests, and a fifth for
// exactly 2^31 - 1 elements that must still succeed; `probe.mjs` runs each in
// a fresh instance under Node.
// docs/security/runtime.md, RT-7; docs/security/codegen.md, CG-9.
import { failed } from "./lib";

export const main = (): number => {
  mkdirSync("build");
  mkdirSync("build/rt_sec_wasm_arena");
  const dir = "tests/link/rt_sec_wasm_arena";
  const work = "build/rt_sec_wasm_arena";
  const wasm = `${work}/probe.wasm`;
  const built = spawnSyncTo(
    ["bash", "scripts/build.sh", `${dir}/probe.c`, "runtime/runtime-wasm.c", "-o", wasm, "--profile", "wasm"],
    `${work}/build.out`,
    `${work}/build.err`
  );
  if (built !== 0) {
    console.log(failed("build", built));
    return 1;
  }
  const ran = spawnSync(["node", `${dir}/probe.mjs`, wasm]);
  if (ran !== 0) {
    console.log(failed("node", ran));
    return 1;
  }
  return 0;
};
