// A `Secret` cannot be a `Result` payload: hand one back as `Secret<T> | null`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const f = (): Result<Secret<u8[]>, string> => Err("no");
export const main = (): i32 => 0;
