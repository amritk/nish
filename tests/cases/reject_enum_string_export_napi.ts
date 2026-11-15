// --emit-napi refuses an exported function that returns a string enum's array:
// a JavaScript caller would get the ordinals, not the strings.
enum Role {
  Admin = "admin",
  Guest = "guest",
}

export const everyone = (): Role[] => [Role.Admin, Role.Guest]
