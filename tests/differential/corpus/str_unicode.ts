// .length is the UTF-8 byte length; bytes pass through concat and output unchanged.
export function main(): number {
  const accented = "héllo";
  const kanji = "日本語";
  const emoji = "🎉";
  const arrow = "→";
  console.log(accented);
  console.log(accented.length);
  console.log(kanji);
  console.log(kanji.length);
  console.log(emoji);
  console.log(emoji.length);
  console.log(arrow.length);
  const mixed = accented + " " + kanji + " " + emoji + " " + arrow;
  console.log(mixed);
  console.log(mixed.length);
  console.log(`${accented}|${kanji}|${emoji}`);
  console.log(accented === "héllo");
  console.log(accented === "hello");
  console.log(kanji + kanji === "日本語日本語");
  let s = "";
  for (let i = 0; i < 5; i++) {
    s = s + arrow;
  }
  console.log(s);
  console.log(s.length);
  console.log("ß".length);
  console.log("é".length);
  console.log("é".length);
  console.log("Ω≈ç√∫".length);
  return 0;
}
