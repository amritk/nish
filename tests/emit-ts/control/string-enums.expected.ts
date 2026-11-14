// A string enum becomes a `const` object whose members are their strings, the
// value `tsc` gives each one, and a type of the same name. `String(r)` is then
// the identity, and prints what the native program reads from its table.
import { idx } from "nish/runtime"
import type { i32 } from "nish/runtime"
export const Role = {
  Admin: "admin",
  Guest: "guest",
  Empty: "",
  Cafe: "café",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

const Level = { Low: "low", High: "high" } as const;
type Level = (typeof Level)[keyof typeof Level];

class Badge {
  readonly kind: (typeof Role.Admin) = Role.Admin
  label: string = "root"
}

class Pass {
  readonly kind: (typeof Role.Guest) = Role.Guest
  hours: i32 = 2
}

type Ticket = Badge | Pass

const rank = (r: Role): i32 => {
  switch (r) {
    case Role.Admin:
      return 3
    case Role.Guest:
      return 1
    case Role.Cafe:
      return 2
    default:
      return 0
  }
}

const describe = (t: Ticket): string => {
  if (t.kind === Role.Admin) {
    return `badge ${t.label}`
  }
  return `pass ${t.hours}`
}

export const main = (): number => {
  const all: Role[] = [Role.Admin, Role.Guest, Role.Empty, Role.Cafe]
  for (const r of all) {
    console.log(`${String(r)}|${rank(r)}`)
  }
  const admin: (typeof Role.Admin) = Role.Admin
  console.log(`${admin === Role.Admin} ${idx(all, 1) !== Role.Admin}`)
  const l: Level = Level.High
  console.log(String(l))
  const tickets: Ticket[] = [new Badge(), new Pass()]
  for (const t of tickets) {
    console.log(`${describe(t)} ${String(t.kind)}`)
  }
  return 0
}
