// A surrogate escape with no partner is not joined to anything: it keeps its
// three WTF-8 bytes, as it did before pairs were joined (docs/LANGUAGE.md,
// "String literals"). A low surrogate before a high one is two lone
// surrogates, and the pair is joined only in the literal, so concatenating two
// halves at run time is six bytes where JavaScript would see one code point.
export const main = (): i32 => {
  const high = "\uD83D";
  console.log(`${high.length} ${high.charCodeAt(0)} ${high.charCodeAt(1)} ${high.charCodeAt(2)}`);
  const low = "\u{DE00}";
  console.log(`${low.length} ${low.charCodeAt(0)} ${low.charCodeAt(1)} ${low.charCodeAt(2)}`);
  console.log(`${"\uDE00\uD83D".length} ${"\uD83Dx\uDE00".length} ${"\uD83DA".length}`);
  console.log(`${high + "\uDE00" === "\uD83D\uDE00"} ${(high + "\uDE00").length}`);
  return 0;
};
