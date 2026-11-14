// --emit-header refuses an exported function that takes a string enum: it is
// an ordinal natively and a string in TypeScript, and a host could pass neither.
enum Role {
  Admin = "admin",
  Guest = "guest",
}

export const rank = (r: Role): i32 => (r === Role.Admin ? 2 : 1)
