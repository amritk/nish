// A built-in type name is resolved from the syntax, so an alias under one
// would never be looked at. Silently doing nothing is the failure worth
// refusing.
type string = i32;

export function test(): number {
  return 0;
}
