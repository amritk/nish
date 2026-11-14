// A string does not become a member: write the member.
enum Role {
  Admin = "admin",
}

export const test = (): i32 => {
  const r: Role = "admin";
  return r === Role.Admin ? 1 : 0;
};
