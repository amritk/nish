// An alias names a type inside one module: there is no symbol to link and no
// way for an importer's signatures to resolve it, so `export` is refused
// rather than accepted and then unusable.
export type Byte = u8;

export function test(): number {
  return 0;
}
