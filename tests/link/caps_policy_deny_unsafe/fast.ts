import { uncheckedGet } from "nish:unsafe";

export const first = (xs: i32[]): i32 => (xs.length > 0 ? uncheckedGet(xs, 0) : 0);
