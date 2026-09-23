// The constraint is a class here, and `main.ts` declares a `Base` of its own.
export class Base {
  x: i32 = 0;
}

export const f = <T extends Base>(t: T): i32 => t.x;
