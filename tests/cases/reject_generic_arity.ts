// The arity of a generic call is checked against the template, so the message
// names `pair` rather than a symbol that does not exist yet. WP18 §8.
const pair = <A, B>(a: A, b: B): A => a;

export const test = (): number => pair(1);
