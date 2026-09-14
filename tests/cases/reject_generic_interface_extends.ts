// An interface is a field list, so there is no layout to inherit. The rule
// belongs to the declaration rather than to a member, which is why a generic
// interface has to reach it too.
interface Base {
  a: i32;
}

interface Box<T> extends Base {
  value: T;
}
