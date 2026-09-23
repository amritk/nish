// WP18 G8: a generic method is a member like any other, so a field declared
// after it with the same name is a duplicate. Without the check `c.pick` would
// read the field and `c.pick(1)` call the method: one name, two members.
class Chooser {
  pick<T>(a: T): T {
    return a;
  }

  pick: i32 = 0;
}

export const test = (): number => new Chooser().pick;
