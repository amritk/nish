# Security record: the outbound policy

The record of `nish/net/outbound`, the policy a program sets on
`nish/net/http-client` when it fetches URLs it did not choose (a webhook
sender, a link previewer, an importer that takes a URL from a form), and of
the hooks in the client that apply it. It says which addresses count as
public, where the check runs and why a DNS answer cannot move a connection
past it, what a redirect is checked against, what the host allowlist matches,
and the test that pins each property. It is written with the code, at base
commit `77091008`, rather than after an audit. It names functions rather than
lines, so it holds at any commit that has them.

**Result.** Under a policy, the client connects only to an address
`outboundAddressAllowed` accepts, and it connects to the very bytes it
checked: `dial` resolves the name once, `outboundFilter` drops every refused
address from that answer in place, and `tcpConnect` is given only what is
left, so there is no second lookup a rebinding answer could change. Every
redirect hop goes through the same `dial`, and through the host allowlist
again, so a public URL that redirects inward is refused at the hop. Public is
the IANA special-purpose registries read strictly; IPv4-mapped, NAT64 and
6to4 addresses are judged by the IPv4 address they carry. A policy turns off
the proxy, which would otherwise resolve and connect on the client's behalf,
and caps redirects, total time and body size at the stricter of its own
limits and the options'. Four findings were fixed while the module was
written (OB-1 High, OB-2 Medium, OB-3 and OB-4 Low); three are open
(OB-5 to OB-7, Low).

## Scope

| File | Functions |
| --- | --- |
| `std/net/outbound.ts` | `OutboundPolicy` (`allowHost`, `permit`), `outboundAddressPublic`, `outboundAddressAllowed`, `outboundFilter`, `outboundHostAllowed`, `outboundAddressText`; and the helpers (`outboundV4Public`, `outboundZeros`, `outboundPrefixMatch`, `outboundDecimal`, `outboundIsLiteral`, `outboundLower`, `outboundTrimDot`) |
| `std/net/http-client.ts` | The policy's hooks only: `HttpOptions.outbound`, `HTTP_E_BLOCKED`, `HttpClient.hostAllowed`, the policy branch of `HttpClient.dial`, the proxy choice in `HttpClient.open`, the hop check in `HttpClient.fetch`, and `httpClientBodyCap`, `httpClientTotalMs`, `httpClientMaxRedirects`. The rest of the client is [`http-client.md`](http-client.md)'s |

Out of scope: the stub resolver of `std/net/dns-resolver.ts` and the address
parser `dnsParseAddress` ([`dns.md`](dns.md)), whose answer the policy
judges; the URL parser of `std/net/url.ts` ([`url.md`](url.md)), whose `host`
the allowlist matches; and every other way a program can open a connection
(`tcpConnect`, the HTTP/2, HTTP/3 and WebSocket clients), which the policy
does not cover (OB-6).

## Threat model

The attacker chooses the URL, and may run the server it names and the DNS
zone its name is in. They want the program to reach an address it can reach
and they cannot: a loopback service, a host on a private network, a cloud
metadata endpoint. Their tools are a literal address in any of its spellings
(dotted IPv4, IPv4-mapped or NAT64 IPv6, `[::1]`), a name that resolves to
one, a name whose answer changes between two lookups (DNS rebinding), a
public URL that redirects to one, the proxy a program was configured with,
and a URL whose userinfo or host only resembles an allowed name. The
operator who builds the policy is trusted, as are `/etc/hosts` and the
resolver configuration: the policy judges their answers too, but does not
second-guess what they say a name is.

Not in the model: what the attacker learns from the response (that is the
program's to decide), and timing that tells a refused address from an
unreachable one.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| OB-1 | High | `HttpClient.open` | A program that set `useEnvProxy` sent a policed fetch to its proxy, which resolves and connects for it: the address check never saw an address, so a URL naming `127.0.0.1` reached whatever the proxy could. | **Fixed** before the module shipped: a policy turns the proxy off and the fetch goes direct, through `dial`'s check. Before, `with one, the proxy is ignored and the fetch goes direct` failed; after, it passes. |
| OB-2 | Medium | `HttpClient.fetch` | The host allowlist was checked on the URL the caller passed, not on a redirect's target, so an allowed host that redirects (an open redirect is enough) took the fetch to any public host. | **Fixed** before the module shipped: every hop's URL goes through `hostAllowed` before it is dialled. Before, `with one, a redirect to a host not on the allowlist is HTTP_E_BLOCKED, naming does not allow` and `and no connection past the first hop` failed; after, they pass. |
| OB-3 | Low | `outboundAddressPublic` | A 6to4 address (`2002::/16`) was judged as the global IPv6 address it looks like, so `2002:7f00:1::` (6to4 for `127.0.0.1`) and the like passed wherever a 6to4 relay delivers them. | **Fixed** before the module shipped: a 6to4 address is public only when the IPv4 address in its bits 16 to 47 is. Before, `6to4 2002::/16 is judged by the IPv4 address in it` failed; after, it passes. |
| OB-4 | Low | `outboundHostAllowed` | A leading-dot entry matched by suffix whatever the host was, so an entry such as `.0.0.1` allowed the IPv4 literal `127.0.0.1`. | **Fixed** before the module shipped: an IPv4 literal matches only an entry equal to it. Before, `a dotted entry is never a suffix of an IPv4 literal` failed; after, it passes. |
| OB-5 | Low | `HttpClient.dial` | A name the attacker chose is still looked up, so the lookup itself reaches their nameserver, and a label of it can carry data out (DNS exfiltration) even when every address it answers is refused. | **Open, accepted.** The check needs the answer. `allowHost` refuses a name before any lookup (`a URL naming a host not on it is blocked before the lookup`), which is the remedy where the set of hosts is known. |
| OB-6 | Low | `std/net` | The policy covers `nish/net/http-client` alone. A program that opens a connection to an attacker's URL another way (`tcpConnect`, the HTTP/2, HTTP/3 or WebSocket clients) has no address check. | **Open, accepted.** Recorded so a program does not assume otherwise; the guide page says which client takes a policy. |
| OB-7 | Low | `OutboundPolicy.permit` | A permitted prefix is permitted for every name, so an attacker's name that resolves into it reaches the internal service it was opened for. | **Open, by design.** A permit is an address decision; pairing it with `allowHost` ties it to names. Pinned by `a redirect to a name is followed when an address it resolves to is permitted`, so a change to this is a decision, not an accident. |

## Fuzzing

Not fuzzed. The policy's inputs are a 16-byte address, a host string matched
by equality and suffix, and a CIDR string parsed by `dnsParseAddress` (fuzzed
under [`dns.md`](dns.md)) plus a decimal length; each range test is a fixed
prefix compare. The checks below take each range at its edges instead: the
first and last address inside and the first outside.

## Properties verified

Each property below is pinned by a check that fails if it stops holding. The
checks are in `tests/link/net_outbound/checks.ts`, run as
`link/net_outbound: exits with 0 and stdout matches expected.out` (the
template `link/${name}: exits with ${wantCode} and stdout matches
expected.out` in `tests/run.js`), and again under `--number-mode f64` as
`link/net_outbound_f64`; each check's own line is in `expected.out`. The test
is its own server on a loopback port and fetches it with and without a
policy, so each refusal has a `without a policy, … is reached` twin showing
the URL would otherwise connect, and a count of accepted connections showing
the refused one made none.

- **Every special-purpose range is refused, and only those.** IPv4: `this
  network, 10/8, CGNAT's 100.64/10 and loopback 127/8 are not`, `link-local
  169.254/16, the metadata address among it, and 168.63.129.16 are not`,
  `172.16/12, 192.168/16 and the special and documentation /24s and 198.18/15
  are not`, `multicast, the reserved 240/4 and broadcast are not`, and `the
  addresses just outside each range are public`. IPv6: `unspecified,
  loopback, IPv4-compatible, discard, link-local, site-local and multicast
  IPv6 are not`, `unique local fc00::/7, the IPv6 metadata address among it,
  is not`, `2001::/23 (Teredo among it), 2001:db8::/32 and 3fff::/20 are not`.
- **An IPv4 address in IPv6 clothing is judged as IPv4.** `an IPv4-mapped
  address is judged as the IPv4 address it maps`, `NAT64 64:ff9b::/96 is
  judged by the IPv4 address in it, and the local 64:ff9b:1::/48 is not
  public`, `6to4 2002::/16 is judged by the IPv4 address in it`, `and each is
  public when that address, or the address itself, is`.
- **The check is on the resolved address, and the connection goes to it.**
  `with one, localhost is HTTP_E_BLOCKED, naming resolves to` and its `and no
  connection was made`; `outboundFilter keeps a lookup's public addresses, in
  order, and drops the rest`; `and keeps none of an answer with no public
  address, which is left in place to be named`. `dial` passes `tcpConnect`
  only the bytes `outboundFilter` kept, with no second lookup.
- **Literals in every spelling are refused before a connect.** `with one, a
  loopback address is HTTP_E_BLOCKED, naming 127.0.0.1`, `with one, an
  IPv4-mapped loopback literal is HTTP_E_BLOCKED, naming 127.0.0.1`, each
  with `and no connection was made`.
- **Every redirect hop is checked again.** `a redirect to another loopback
  address is blocked at the hop`, `and so is one to it written as an
  IPv4-mapped IPv6 literal`, `and one to [::1]`, `and one to the metadata
  address, before any connect is tried`; and for the allowlist, OB-2's checks.
- **`permit` lets exactly its prefix through.** `permit lets one IPv4
  address through, in either form, and nothing beside it`, `a prefix ending
  inside a byte matches on its bits`, `an IPv6 prefix`, `an address without a
  length is the address alone`, `0.0.0.0/0 is every IPv4 address and no IPv6
  one`, `a prefix too long for its address, a bad address or length, or a
  short IPv4 form, is refused and adds nothing`.
- **The allowlist matches names, not lookalikes.** `an allowed name matches
  in any case, with or without its trailing dot`, `but only itself`, `a
  leading dot allows the name and the names under it, nothing that only ends
  the same way`, `a bracketed IPv6 entry matches the URL's host`, `a dotted
  entry is never a suffix of an IPv4 literal`, and `with one, an allowed name
  in the userinfo is HTTP_E_BLOCKED, naming does not allow`.
- **A policy turns the proxy off.** OB-1's check, after `without a policy, a
  fetch goes to the proxy (here one nothing listens on)`.
- **The caps are the stricter of the policy's and the options'.** `a new
  policy caps a fetch at 5 redirects, 30 s and 8 MiB`, `under a policy of
  two, two are` and `and three are HTTP_E_TOO_MANY_REDIRECTS`, `under a policy
  capping bodies at 10 bytes, it is HTTP_E_BODY_TOO_LARGE`, `under a policy
  of 200 ms with no total timeout of the options', it is
  HTTP_E_TOTAL_TIMEOUT`.
- **No policy changes nothing.** `a client has no outbound policy unless
  given one`, and every `without a policy` check above.
