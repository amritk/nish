// A surrogate-pair escape is the code point it spells (issue #246): the pair
// encodes as the four UTF-8 bytes of U+1F600, not two three-byte halves, so it
// is the same string as the literal emoji and the braced escape, whichever of
// the two escape forms spells each half, in a string or a template's own text.
export const main = (): i32 => {
  const pair = "\uD83D\uDE00";
  const braced = "\u{1F600}";
  const literal = "😀";
  console.log(`${pair === literal} ${pair === braced} ${pair.length} ${literal.length}`);
  console.log(`${"\u{D83D}\u{DE00}" === literal} ${"\uD83D\u{DE00}" === literal}`);
  console.log(`a${pair}b`);
  const whole = `\uD83D\uDE00`;
  const split = `a${1}\uD83D\uDE00b`;
  console.log(`${whole === literal} ${whole.length} ${split.length} ${split} ${"\u{10FFFF}".length}`);
  return 0;
};
