// WP89 S6: a wasm32 build takes a package's `nish-wasm32` condition before
// `nish-<mode>` and `nish`, and a native build ignores it.
//
// `pkg_target` names three files. The suite links this program natively (the
// `args` target dropped) and runs it: the exit code is 7 only from
// `./native.ts`, the `nish-i32` file, 164 (that is -92) from `./any.ts` and
// 107 from `./wasm.ts`.
// It then compiles it for wasm32, which must succeed: `./native.ts` and
// `./any.ts` both read the environment, which a wasm32 build refuses
// (NL2404), so only `./wasm.ts` compiles there.
import { seed } from "pkg_target";

export const main = (): i32 => seed() - 93;
