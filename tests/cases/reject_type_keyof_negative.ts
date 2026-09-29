// `keyof` before a negative number is the operator, as TypeScript reads it:
// a type is read after `keyof` wherever `parsePrimaryType` reads one, `-128`
// included (NL2038).
type Low = keyof -128

export const main = (): i32 => 0
