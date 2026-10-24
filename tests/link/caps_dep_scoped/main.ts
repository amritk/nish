// WP40: a scoped package is named by its scope and name, `@acme/http`, in
// the refusal and in the grant that would accept it.
import { fetchText } from "@acme/http";

export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
