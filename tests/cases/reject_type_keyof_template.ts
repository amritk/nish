// `keyof` in a generic interface nothing instantiates. A template's members
// are resolved once per instantiation, so the rule is a sweep over the module
// in pass 1 and this one is refused too (NL2038).
export interface Keyed<T> {
  key: keyof T
}

export const main = (): i32 => 0
