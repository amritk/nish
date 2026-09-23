// A fixture for `tests/nish-cmp.js`: the packed-`Result` payloads
// the rest of the interop corpus never mentions.
//
// `tests/cases/res_export.ts` covers `i32` and `void` arms, which is what the
// WP8 section of the suite builds and calls. The generators also have a reader
// and a writer per *narrow* payload — `f32` reinterprets its 32 bits rather
// than converting them, and `u8` / `u16` / `u32` each mask a different width —
// and the wasm loader grows its `f32View` bit-view helpers only when an `f32`
// payload actually crosses. None of that is reachable from the corpus, so it
// lives here: four signatures, one per shape, taken and returned.
export function halfF32(n: f32): Result<f32, u8> {
  if (n < 0.0) {
    return Err(toU8(1));
  }
  return Ok(n / 2.0);
}

export function widen(r: Result<f32, u8>): f32 {
  if (r.isErr()) {
    return 0.0;
  }
  return r.value;
}

export function port(p: u16): Result<void, u16> {
  if (p === toU16(0)) {
    return Err(p);
  }
  return Ok();
}

export function flag(b: boolean): Result<boolean, u32> {
  if (b) {
    return Ok(true);
  }
  return Err(toU32(7));
}
