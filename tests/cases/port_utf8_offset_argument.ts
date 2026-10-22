// WP33 NL8001 (#629): an offset passed to a function, a method or a
// constructor is followed into the callee, and reported at the argument where
// the callee lets it out, with the callee's own reason — through a callee
// that hands it on, too. A callee that only
// hands it to a string method keeps it inside the program's counting.
class Ruler {
  marks: i32[];

  constructor(width: i32) {
    this.marks = [];
    this.marks.push(width);
  }

  show(n: i32): void {
    console.log(n);
  }
}

const shout = (n: i32): void => {
  console.log(n);
};

const relay = (n: i32): void => {
  shout(n);
};

const tail = (text: string, from: i32): string => text.substring(from, text.length);

export const main = (): number => {
  const word = "héllo";
  shout(word.indexOf("l"));
  relay(word.length);
  const ruler = new Ruler(word.length);
  ruler.show(word.indexOf("o"));
  console.log(ruler.marks.length);
  console.log(tail(word, word.indexOf("l")));
  return 0;
};
