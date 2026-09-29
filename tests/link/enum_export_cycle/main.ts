import { Color, paint } from "./colors";
import { Shape, favourite } from "./shapes";

export const main = (): number => {
  const c: Color = paint(Shape.Square);
  const s: Shape = favourite(c);
  console.log(c === Color.Green ? "green" : "red");
  console.log(s === Shape.Square ? "square" : "triangle");
  return 0;
};
