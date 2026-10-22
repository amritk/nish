// WP33 NL8001 (#629): an offset a helper returns is followed from every call
// of it in the module, through as many helpers as hand it on, and reported at
// the call where it ends. A call whose string argument is provably ASCII
// answers the same number in both units and stays quiet.
const firstL = (s: string): i32 => s.indexOf("l");

const width = (s: string): i32 => firstL(s) + 1;

export const main = (): number => {
  const word = "héllo";
  console.log(firstL(word));
  const w = width(word);
  console.log(w);
  console.log(firstL("hello"));
  return 0;
};
