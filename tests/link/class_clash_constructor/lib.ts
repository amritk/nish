// A class `Base` with a constructor, exported; `main.ts` declares its own.
export class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const one = (): i32 => 1;
