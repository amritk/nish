// #613, review round 2: a holder whose fields reach `Box<T>`. Each importer
// beside `main.ts` reaches a holder first as a type argument, which registers
// the holder and every struct its fields reach layout-only, and then calls a
// generic that answers the same holder, whose fields' methods it calls.

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }
}

export class Wrap<T> {
  b: Box<T>;

  constructor(b: Box<T>) {
    this.b = b;
  }
}

export class Many<T> {
  bs: Box<T>[];

  constructor(b: Box<T>) {
    this.bs = [b];
  }
}

export class Maybe<T> {
  b: Box<T> | null;

  constructor(b: Box<T>) {
    this.b = b;
  }
}

export class Res<T> {
  r: Result<Box<T>, string>;

  constructor(b: Box<T>) {
    this.r = Ok(b);
  }
}

export class Deep<T> {
  w: Wrap<T>;

  constructor(w: Wrap<T>) {
    this.w = w;
  }
}

export const box = <T>(v: T): Box<T> => new Box<T>(v);
export const wrap = <T>(v: T): Wrap<T> => new Wrap<T>(box(v));
export const many = <T>(v: T): Many<T> => new Many<T>(box(v));
export const maybe = <T>(v: T): Maybe<T> => new Maybe<T>(box(v));
export const res = <T>(v: T): Res<T> => new Res<T>(box(v));
export const deep = <T>(v: T): Deep<T> => new Deep<T>(wrap(v));
export const nest = <T>(v: T): Wrap<Wrap<T>> => new Wrap<Wrap<T>>(box(wrap(v)));
