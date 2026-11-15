// Two members with one string would decode to the same member, so the second
// is refused: the string is how JSON and `String` name a member.
enum Role {
  Admin = "admin",
  Root = "admin",
}

export const test = (): i32 => 0;
