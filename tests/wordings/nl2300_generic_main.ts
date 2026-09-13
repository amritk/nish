// NL2300: the entry point is called by the C runtime, which has no type
// arguments to give it, so there is no tuple to monomorphise `main` at.
export function main<T>(x: T): i32 {
  return 0;
}
