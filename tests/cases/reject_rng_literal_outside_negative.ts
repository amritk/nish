// WP31 §6: the sign is part of the literal, so `-1` is outside `integer<0, 9>`
// when it is returned into one.
const below = (): integer<0, 9> => -1

export const main = (): number => below()
