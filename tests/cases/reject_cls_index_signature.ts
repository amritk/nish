// An index signature would make the layout depend on a runtime key.
export class Point {
  [key: string]: number;
}
