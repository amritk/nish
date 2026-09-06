/** Interop generators (WP8): C header, wasm `.d.ts`, N-API shim. */
export { generateHeader } from "./header";
export { generateDts } from "./dts";
export { generateWasmLoader, wasmLoaderPath } from "./wasm";
export { generateNapiShim } from "./napi";
export { externalFunctions, cType, typedView } from "./abi";
