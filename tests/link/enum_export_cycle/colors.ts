// Two modules that import each other's enums: `colors.ts` names `Shape` in a
// signature and `shapes.ts` names `Color`, so neither module's signatures can
// be collected until the other's enum is declared, which is the order the
// load now keeps.
import { Shape, sides } from "./shapes";

export enum Color {
  Red = 1,
  Green = 2,
}

export const paint = (s: Shape): Color => (sides(s) > 3 ? Color.Green : Color.Red);
