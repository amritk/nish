// `declare module "m"` describes a module some other file implements; Nish
// resolves every module at compile time from its source (NL1027).
declare module "fs" {
  export function readFileSync(path: string): string
}

export const main = (): i32 => 0
