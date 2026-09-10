// Generic aliases stay forbidden: the language monomorphises nothing, and a
// `type` alias is not a way in.
type Box<T> = T[];

export function test(): number {
  return 0;
}
