// --deny-panics refuses a `pop` on an array not known to hold an element.
export const last = (xs: i32[]): i32 => xs.pop();
