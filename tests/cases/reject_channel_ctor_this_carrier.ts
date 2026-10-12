// #567: a store into a field of what a field holds is admitted only when that
// object neither is a channel nor holds one; `inner` holds the channel. The
// class is refused where it is declared, before any scope is given one.
import { Channel, scope } from "nish/threads";

class Inner {
  ch: Channel<i32>;
  n: i32 = 0;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
  }
}

class Late {
  ch: Channel<i32>;
  inner: Inner;

  constructor(ch: Channel<i32>, inner: Inner) {
    this.ch = ch;
    this.inner = inner;
    this.inner.n = 1;
  }
}

