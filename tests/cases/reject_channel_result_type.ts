// C2: a type holds a channel only as `Channel<T>`, not as a `Result`'s arm.
import { Channel, scope } from "nish/threads";

const wrap = (n: i32): Result<Channel<i32>, i32> => Err(n);

export const main = (): i32 => 0;
