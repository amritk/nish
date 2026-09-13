// A type parameter is inferred from the arguments and from nothing else, so
// `T` here can never be bound and `empty` could never be called. WP18 §2a.
const empty = <T>(): T[] => [];

export const test = (): number => 0;
