// WP33 NL8001, the quiet side: a string that is a literal of ASCII bytes has
// the same length, the same offsets and the same codes in UTF-8 bytes and in
// UTF-16 units, so printing, storing or comparing them is the same number in
// both readings — whether the literal is written in place, bound to a `const`
// or a module constant — or built only out of ASCII pieces, however often the
// local is reassigned.
const GREETING: string = "hello there";

export const main = (): number => {
  const word = "plain";
  console.log(word.length);
  console.log(GREETING.length);
  console.log("abc".indexOf("c") + 2);
  const sizes: i32[] = [word.length, GREETING.indexOf("t")];
  if (word.charCodeAt(0) === 112 && sizes[0] > 3) {
    console.log(`${word} starts with p`);
  }
  let built = "abc";
  built = built + "x";
  console.log(built.length);
  return 0;
};
