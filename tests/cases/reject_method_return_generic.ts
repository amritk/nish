// A generic method is collected only once a call picks its type arguments, so
// its missing return type is the pass 1 sweep's to refuse, called or not.
export class Box {
  value: i32 = 0;
  first<T>(items: T[]) {
    return items[0];
  }
}
