// `Ok(...)` carries no type of its own; like `null` it takes one from the
// context, and without one there is no monomorphisation to build.
export function main(): i32 {
  const outcome = Ok(1);
  if (outcome.isOk()) {
    return outcome.value;
  }
  return 0;
}
