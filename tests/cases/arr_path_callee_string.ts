// #106: a call drops a *string* path too. A string's length cannot change,
// which is why a call keeps the facts of a string held in a local; a string
// held in a field can still be replaced, and `shorten` does exactly that
// through the same object. The loop proves `i < t.text.length` and reads
// `t.text.charCodeAt(i)` after the call, which must keep its check. Run by
// tests/run.js: exit 1 with "index out of range: 1 >= 1" on stderr, after
// "97" on stdout.
class Text {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const shorten = (t: Text, i: i32): void => {
  if (i === 1) {
    t.text = "z";
  }
};

export const main = (): number => {
  const t = new Text("abc");
  let i = 0;
  while (i < t.text.length) {
    shorten(t, i);
    const c = t.text.charCodeAt(i);
    console.log(`${c}`);
    i = i + 1;
  }
  return 0;
};
