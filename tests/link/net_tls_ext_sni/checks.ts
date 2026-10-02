// `server_name` in `nish/net/tls` (RFC 6066 §3): the client's host name is
// read and exposed as `serverName`, and acknowledged with an empty
// `server_name` in EncryptedExtensions; a client that sends none gets no
// acknowledgement. A name type other than `host_name` is skipped. Two host
// names, or one with a byte outside printable ASCII, are `illegal_parameter`,
// and an empty one is `decode_error` (HostName<1..2^16-1>).
import { Suite } from "nish/testing";
import { TLS_ALERT_DECODE_ERROR, TLS_ALERT_ILLEGAL_PARAMETER, TLS_EXT_SERVER_NAME } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TlsServer } from "nish/net/tls";
import { ascii, cat, clientHello, extServerName, extension, sendHello, standardExtensions, standardWith, vec16 } from "../net_tls_common/client";
import { newServer, tcpConfig } from "../net_tls_common/server";
import { encryptedExtensionsOf } from "../net_tls_ext_alpn/checks";

/** `server_name` with each entry's own type and name. */
const serverNames = (types: i32[], names: string[]): u8[] => {
  const entries: u8[][] = [];
  for (let k: i32 = 0; k < toI32(types.length) && k < toI32(names.length); k++) {
    entries.push(cat([[toU8(types[k])], vec16(ascii(names[k]))]));
  }
  return extension(TLS_EXT_SERVER_NAME, vec16(cat(entries)));
};

/** Runs every check and answers the exit code. */
export const sniChecks = (): i32 => {
  const t = new Suite("tls sni");
  const zero: i32 = 0;
  const suites: i32[] = [TLS_AES_128_GCM_SHA256];
  const none: string[] = [];

  const named: TlsServer = newServer(tcpConfig(none));
  t.eqI32(
    "a ClientHello naming example.com is accepted",
    sendHello(named, clientHello(suites, standardWith([extServerName("example.com")]))),
    zero
  );
  t.eqStr("serverName is the host name", named.serverName, "example.com");
  t.eqStr("EncryptedExtensions acknowledges it with an empty server_name", encryptedExtensionsOf(named), "08000006000400000000");

  const anonymous: TlsServer = newServer(tcpConfig(none));
  sendHello(anonymous, clientHello(suites, standardExtensions()));
  t.eqStr("without server_name, serverName is empty", anonymous.serverName, "");
  t.eqStr("and nothing is acknowledged", encryptedExtensionsOf(anonymous), "080000020000");

  const other: TlsServer = newServer(tcpConfig(none));
  t.eqI32(
    "a name of another type before the host name is skipped",
    sendHello(other, clientHello(suites, standardWith([serverNames([7, 0], ["opaque", "relay.test"])]))),
    zero
  );
  t.eqStr("and the host name is still read", other.serverName, "relay.test");

  t.eqI32(
    "two host names are illegal_parameter",
    sendHello(newServer(tcpConfig(none)), clientHello(suites, standardWith([serverNames([0, 0], ["a.test", "b.test"])]))),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a space in the host name is illegal_parameter",
    sendHello(newServer(tcpConfig(none)), clientHello(suites, standardWith([extServerName("bad name")]))),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "an empty host name is decode_error",
    sendHello(newServer(tcpConfig(none)), clientHello(suites, standardWith([extServerName("")]))),
    TLS_ALERT_DECODE_ERROR
  );
  const empty: u8[] = [];
  t.eqI32(
    "an empty server_name list is decode_error",
    sendHello(newServer(tcpConfig(none)), clientHello(suites, standardWith([extension(TLS_EXT_SERVER_NAME, vec16(empty))]))),
    TLS_ALERT_DECODE_ERROR
  );
  return t.done();
};
