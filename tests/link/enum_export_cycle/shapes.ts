import { Color } from "./colors";

export enum Shape {
  Triangle = 3,
  Square = 4,
}

export const sides = (s: Shape): i32 => (s === Shape.Triangle ? 3 : 4);

export const favourite = (c: Color): Shape => (c === Color.Red ? Shape.Triangle : Shape.Square);
