import { readFileSync } from "nish:fs"

export const main = (): number => {
  console.log(readFileSync("/etc/hostname").length > 0)
  return 0
}
