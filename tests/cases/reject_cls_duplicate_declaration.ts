// One name, one declaration: a class and an interface cannot share it.
export class Point {
  x: number = 0;
}

export interface Point {
  x: number;
}
