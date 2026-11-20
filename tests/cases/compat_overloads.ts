// WP28 C1, `overloads`: a function, a method and a constructor each written as
// bodiless signatures before one implementation, as TypeScript reads them.
// The signatures are checked and then lifted, so the program compiles to the
// implementation alone, and each call runs it as Node does.
function area(side: number): number;
function area(width: number, height: number): number;
function area(width: number, height: number = -1): number {
  return height < 0 ? width * width : width * height;
}

class Scale {
  factor: number;
  constructor();
  constructor(factor: number);
  constructor(factor: number = 2) {
    this.factor = factor;
  }

  apply(x: number): number;
  apply(x: number, offset: number): number;
  apply(x: number, offset: number = 0): number {
    return x * this.factor + offset;
  }
}

export const main = (): void => {
  console.log(`${area(3)} ${area(2, 5)}`);
  const twice = new Scale();
  const thrice = new Scale(3);
  console.log(`${twice.apply(4)} ${thrice.apply(4)} ${thrice.apply(4, 1)}`);
};
