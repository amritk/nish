/** Interop generators (WP8): C header, wasm `.d.ts`, N-API shim. */
export { generateHeader } from "./header.js";
export { generateDts } from "./dts.js";
export { generateWasmLoader, wasmLoaderPath } from "./wasm.js";
export { generateNapiShim } from "./napi.js";
export { externalFunctions, cType, typedView } from "./abi.js";
