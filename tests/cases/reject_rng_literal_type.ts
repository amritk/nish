// WP31 §4: a literal type is parsed wherever a type is, and is only a bound of
// `integer<Lo, Hi>`; anywhere else it would be a literal type in general.
const five: 5 = 5

export const main = (): number => five
