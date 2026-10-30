// `Secret` holds key material, and a vector is not one of the types it wipes.
import { Secret } from "nish:secret";
import { u8x16 } from "nish:simd";

export const f = (s: Secret<u8x16>): i32 => 0;
