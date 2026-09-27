// WP31 §9: under `-g` a ranged type is a `DW_TAG_typedef` of `int` named with
// its display spelling, `integer<0, 255>`, because LLVM 18 cannot write the
// `DW_TAG_subrange_type` DWARF would use for a range. A parameter, a local and
// a field all name the same typedef.
class Level {
  value: integer<0, 255> = 0
}

const brighter = (x: integer<0, 255>): i32 => x + 1

export const main = (): number => {
  const l = new Level()
  const b: integer<0, 255> = 200
  l.value = b
  console.log(`${brighter(l.value)}`)
  return 0
}
