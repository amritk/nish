// An enum names a type inside one module, for the reason a `type` alias does:
// a module's signatures are resolved before its imports are bound, so an
// imported name in type position resolves provisionally as a class, and an
// enum has no layout to stand in for.
export enum Kind {
  If = 1,
}

export const test = (): i32 => 0;
