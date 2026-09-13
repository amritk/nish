// A generic function is monomorphised (WP18); a generic class is not, because
// every instantiation would need a layout of its own. Phase 0 says which.
class C<T> {
  value: T;
}

export const test = (): number => 0;
