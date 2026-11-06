// --emit-ts refuses an async generic that nothing instantiates (NL4016): the
// refusal reads the declarations, so a function with no instance, which the
// native build compiles no body for, is refused as any other async one is.
async function echo<T>(x: T): Promise<T> {
  return x
}

export function main(): i32 {
  return 0
}
