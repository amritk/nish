export enum Kind {
  Scalar = 2,
  Array = 5,
}

// No constructor, so an importer that writes `new ArrayTag()` stores the
// initializer itself, from the integer the checker folded here.
export class ArrayTag {
  readonly kind: Kind.Array = Kind.Array;
}

export const widen = (k: Kind.Array): Kind => k;
