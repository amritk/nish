// The mode is an `i32`; a string spelling of it is not converted.
export function main(): number {
  return mkdirSyncMode("build/test/a.d", "700");
}
