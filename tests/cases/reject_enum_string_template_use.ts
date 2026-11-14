// A template does not print a string enum: `String(r)` names the member.
enum Role {
  Admin = "admin",
}

export const test = (): i32 => {
  const r: Role = Role.Admin;
  console.log(`role ${r}`);
  return 0;
};
