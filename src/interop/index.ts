/** Interop generators (WP8): C header, wasm `.d.ts`, N-API shim. */
export { generateHeader } from "./header";
export { generateDts } from "./dts";
export { generateNapiShim } from "./napi";
export { externalFunctions, cType } from "./abi";
