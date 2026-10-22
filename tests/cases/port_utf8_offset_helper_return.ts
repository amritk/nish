// WP33 NL8001 (#629): an offset a helper returns is followed from every call
// of it in the module, through as many helpers as hand it on, and reported at
// the call where it ends. A call whose string argument is provably ASCII
// answers the same number in both units and stays quiet. An offset passed to
// a helper that answers it back — a concise arrow, or a block body through a
// local — goes on from the call in the caller, and is reported at the
// argument where the caller lets it out; compared with an offset it is quiet.
const firstL = (s: string): i32 => s.indexOf("l");

const same = (n: i32): i32 => n;

function kept(n: i32): i32 {
  const m = n;
  return m;
}

const width = (s: string): i32 => firstL(s) + 1;

export const main = (): number => {
  const word = "héllo";
  console.log(firstL(word));
  const w = width(word);
  console.log(w);
  console.log(firstL("hello"));
  console.log(same(word.length));
  const back = kept(word.indexOf("o"));
  console.log(back);
  if (same(word.indexOf("l")) < word.length) {
    console.log("inside");
  }
  return 0;
};
