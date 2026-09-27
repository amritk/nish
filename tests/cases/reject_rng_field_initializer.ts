// WP31 §6: a field initializer is stored before the constructor runs, with no
// check, so a literal one has to lie inside the field's range.
class Level {
  value: integer<0, 9> = 30
}

export const main = (): number => new Level().value
