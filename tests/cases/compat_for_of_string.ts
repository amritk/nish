// WP28 C1, `for-of-string`: a `for...of` over a `string` binds one code point
// per pass, each a `string` of its UTF-8 bytes, as Node binds one code point
// (not one UTF-16 unit) per pass. ASCII, a two-byte `é`, a three-byte `€` and
// an astral `😀` each take one pass; `break`, `continue` and labels work.
const count = (s: string): number => {
  let n = 0;
  for (const _c of s) {
    n = n + 1;
  }
  return n;
};

export const main = (): void => {
  const text = "aé€😀z";
  for (const c of text) {
    console.log(`[${c}]`);
  }
  console.log(`${count(text)} ${count("")} ${count("plain")}`);
  let kept = "";
  for (let c of "a-b-c!d") {
    if (c === "-") {
      continue;
    }
    if (c === "!") {
      break;
    }
    c = c + c;
    kept = kept + c;
  }
  console.log(kept);
  outer: for (const c of "xé😀") {
    for (const d of "12😀") {
      if (d === "😀") {
        continue outer;
      }
      if (c === "😀") {
        break outer;
      }
      console.log(c + d);
    }
  }
};
