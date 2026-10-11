// C2: a field holds a channel only as `Channel<T>`, not as a generic's type
// argument.
import { Channel, scope } from "nish/threads";

class Box<T> {
  item: T;

  constructor(item: T) {
    this.item = item;
  }
}

class Holder {
  boxed: Box<Channel<i32>> | null = null;
}

export const main = (): i32 => (new Holder().boxed === null ? 0 : 1);
