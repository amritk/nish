// Three `\u{...}` spellings the strings row has to keep apart. `"\\u{41}"` is
// a backslash and then `u{41}`, six bytes, and is no escape; `"\u{D800}"` is a
// lone surrogate, written `\uD800`; `"\u{1F600}"` is past U+FFFF, written as
// its pair `😀`, the one spelling every engine reads. Each prints
// its UTF-8 length, and the first its first byte.
export const main = (): number => {
  const slash = "\\u{41}"
  const lone = "\u{D800}"
  const astral = "\u{1F600}"
  console.log(`${slash.length} ${slash.charCodeAt(0)} ${slash.charCodeAt(1)}`)
  console.log(`${lone.length}`)
  console.log(`${astral.length} ${astral === "😀"}`)
  return 0
}
