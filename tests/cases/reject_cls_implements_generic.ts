// `implements` names an interface and nothing else; there are no type arguments.
export interface Shape {
  x: number;
}

export class Point implements Shape<number> {
  x: number = 0;
}
