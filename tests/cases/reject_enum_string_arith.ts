// A string enum, like a numeric one, has no arithmetic.
enum Role {
  Admin = "admin",
  Guest = "guest",
}

export const test = (): i32 => {
  const r: Role = Role.Admin;
  const next = r + 1;
  return next;
};
