// WP34 N5: `nish:net` exports the functions the compiler has builtins for, and
// there is no `dnsLookup`: names are resolved by the library module
// `nish/net/dns` over these sockets, not by a `nish:net` builtin. The message
// lists what there is.
import { dnsLookup } from "nish:net";

export const main = (): number => 0;
