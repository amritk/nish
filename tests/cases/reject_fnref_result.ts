// WP51 stage 2: a `Result` arm is not a reference place, so `Ok(f)` would
// store a tag no dispatcher's set was built from (natively the call printed 9
// where Node prints 11). A reference in either arm, bare or nullable, is
// refused (NL2762); `reject_fnref_result_generic` reaches one through a
// generic's type parameter.
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1

const okArm = (): Result<F, string> => Ok(plus1)

const nullableArm = (): Result<F | null, string> => Ok(plus1)

const errArm = (): Result<i32, F> => Err(plus1)

export const main = (): void => {
  const r = okArm()
  const n = nullableArm()
  const e = errArm()
  console.log(`${r.ok} ${n.ok} ${e.ok}`)
}
