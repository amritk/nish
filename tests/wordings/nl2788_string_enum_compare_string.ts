// A string enum is not a `string`: compare it with a member, not with text.
enum Role {
  Admin = "admin",
  Guest = "guest",
}

const isAdmin = (r: Role): boolean => r === "admin";

export const test = (): i32 => (isAdmin(Role.Admin) ? 1 : 0);
