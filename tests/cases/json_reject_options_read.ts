// Typed JSON options are not a value the program can read: `User.json` names
// a class where a value is due, which is refused like any class name there.
class User {
  static readonly json = { rename: { id: "user_id" } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const r = User.json;
  return 0;
};
