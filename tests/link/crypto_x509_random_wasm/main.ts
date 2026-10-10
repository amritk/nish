// A wasm32 build that imports `nish/crypto/x509-random` is refused: the module
// draws from `crypto.getRandomValues`, and a wasm32 build has no operating
// system to draw from (X509-6). Its other half, that a wasm32 build importing
// `nish/crypto/x509` alone still compiles, is `x509-only.ts` beside this file,
// which tests/run.js compiles.
import { x509DrawSerial } from "nish/crypto/x509-random"

export const main = (): i32 => toI32(x509DrawSerial().length)
