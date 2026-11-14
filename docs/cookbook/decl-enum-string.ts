enum Role {
  Admin = "admin",
  Guest = "guest",
}

const rank = (r: Role): i32 => {
  switch (r) {
    case Role.Admin:
      return 2
    default:
      return 1
  }
}

export const main = (): number => {
  const r: Role = Role.Guest
  console.log(`${String(r)} ${rank(r)}`)
  return 0
}
