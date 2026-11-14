// A string enum does not convert to `string` on its own: `String(r)` does it.
enum Role {
  Admin = "admin",
}

export const test = (): i32 => {
  const r: Role = Role.Admin;
  const s: string = r;
  return s.length;
};
