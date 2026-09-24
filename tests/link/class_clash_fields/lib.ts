// A class `Base` with one field and nothing else: no constructor, no method, so
// no symbol of its own. `main.ts` declares a different `Base`.
export class Base {
  x: i32 = 0;
}

export const makeBase = (): Base => new Base();
