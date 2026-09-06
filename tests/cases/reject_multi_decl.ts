class Box {
  value: number = 0;
  get size(): number {
    return this.value;
  }
}

interface Shape {
  area(): number;
}

abstract class Circle {
  r: number = 1;
}

function f(): number {
  return 1;
}
