export enum Kind {
  Circle,
  Square,
}

export class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 3;
}

export class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 4;
}

export type Shape = Circle | Square;

export const pick = (round: boolean): Shape => (round ? new Circle() : new Square());

export const isRound = (s: Shape): boolean => s.kind === Kind.Circle;
