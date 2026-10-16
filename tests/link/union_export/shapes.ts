export enum Kind {
  Circle,
  Square,
  Dot,
}

export class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 3;
}

export class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 4;
}

export interface Dot {
  readonly kind: Kind.Dot;
  x: i32;
}

export type Shape = Circle | Square | Dot;

export const pick = (round: boolean): Shape => (round ? new Circle() : new Square());

/** An interface variant, built from an object literal and returned as the union. */
export const dotAt = (x: i32): Shape => {
  const d: Dot = { kind: Kind.Dot, x: x };
  return d;
};

/** The `n`th shape, or `null` past the end. */
export const nth = (shapes: Shape[], n: i32): Shape | null => (n < shapes.length ? shapes[n] : null);

export const isRound = (s: Shape): boolean => s.kind === Kind.Circle;
