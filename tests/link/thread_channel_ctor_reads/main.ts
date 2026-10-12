// #567: the constructor of a class that holds a channel may read its own
// fields, update them in place, and store into what they hold, because none
// of that lets `this` out: a field read here is a number, a string or an array
// of numbers, and nothing reached from one can send. The producer sends
// `first..last`, and the consumer sums them, natively on two threads and
// under Node one after the other; both print the same.
import { Channel, scope } from "nish/threads";

class Range {
  lo: i32 = 0;
  hi: i32 = 0;
}

class Pipe {
  ch: Channel<i32>;
  first: i32;
  last: i32;
  count: i32;
  steps: i32 = 0;
  name: string;
  width: i32;
  marks: i32[];
  span: Range;

  constructor(ch: Channel<i32>, first: i32, last: i32, name: string) {
    this.ch = ch;
    this.first = first;
    this.last = last;
    this.count = this.last - this.first + 1;
    this.steps += 1;
    this.steps += 2;
    this.name = name;
    this.width = this.name.length;
    this.marks = [];
    this.marks.push(this.first);
    this.marks.push(this.last);
    this.span = new Range();
    this.span.lo = this.first;
    this.span.hi = this.last;
  }
}

const produce = (p: Pipe): i32 => {
  for (let i: i32 = p.span.lo; i <= p.span.hi; i++) {
    p.ch.send(i);
  }
  return p.count * 100 + p.steps * 10 + p.width;
};

const consume = (p: Pipe): i32 => {
  let sum: i32 = 0;
  for (const x of p.ch) {
    sum = sum + x;
  }
  return sum + p.marks[0] - p.marks[0];
};

export const main = (): i32 => {
  const sent: i32[] = [0];
  const sums: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 1, 1000, "up"), sent, 0);
    s.spawn(consume, new Pipe(ch, 0, 0, "sum"), sums, 0);
  }
  console.log(`${sent[0]} ${sums[0]}`);
  return 0;
};
