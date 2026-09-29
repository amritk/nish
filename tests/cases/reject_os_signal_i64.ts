// WP34 N3: nor is an i64 narrowed to one.
export const test = (): number => readSignal(toI64(3));
