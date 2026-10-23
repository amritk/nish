// `String.fromBytes` decodes its range as UTF-8, as a native string holds it,
// and `String.fromCharCode` builds its one byte: both through the core's
// helpers rather than the globals.

export const main = (): number => {
  const bytes: u8[] = [104, 195, 169, 33]
  console.log(String.fromBytes([195, 169], 0, 2))
  console.log(String.fromBytes(bytes, 0, bytes.length))
  console.log(String.fromBytes(bytes, 1, 3).length)
  console.log(String.fromCharCode(65) + String.fromCharCode(321))
  return 0
}
