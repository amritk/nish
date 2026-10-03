// `secret` of a parameter leaves the caller holding the plain bytes.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const wrap = (raw: u8[]): Secret<u8[]> => secret(raw);
export const main = (): i32 => 0;
