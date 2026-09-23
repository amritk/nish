// A string path: the second operand replaces the field, and the body reads
// `t.s.charCodeAt(i)` of the one-byte string. Run by tests/run.js: exit 1 with
// "index out of range: 3 >= 1".
class Text {
  s: string;
  constructor(s: string) {
    this.s = s;
  }

  cut(): boolean {
    this.s = "z";
    return true;
  }
}

const code = (t: Text, i: i32): i32 => {
  if (i >= 0 && i < t.s.length && t.cut()) {
    return t.s.charCodeAt(i);
  }
  return -1;
};

export const main = (): number => {
  console.log(`${code(new Text("abcdef"), 3)}`);
  return 0;
};
