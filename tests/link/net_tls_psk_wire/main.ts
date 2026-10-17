// The `pre_shared_key` wire of `nish/net/tls`: RFC 8448's NewSessionTicket,
// resumption PSK, early secret and binder byte for byte, and rows 10-13 of
// "Resumption" in `docs/security/tls.md` as the alerts they answer.
import { pskWireChecks } from "./checks";

export const main = (): i32 => pskWireChecks();
