# Security record: `nish/net/dns-message` and `nish/net/dns-config` — the DNS wire codec and the resolver's files

The record of the first stage of the stub resolver (#986, #479): the DNS
message codec (RFC 1035 §4, with RFC 2181 and RFC 4343's readings) that writes
one A or AAAA question and reads the reply to it, and the readers of
`/etc/resolv.conf` and `/etc/hosts` the resolver starts from. It says what each
module refuses and with what, what it caps and where, and the test that pins
each property. It is written with the code, against `main` at `2cdef4f`, and
cites functions rather than lines.

**Result.** Nothing a peer or a file sends panics, loops or allocates: a
compression loop, a pointer forwards or into the header, a seventeenth hop, a
name past 255 bytes, a count larger than the message holds, a record whose
RDATA runs past the end or has the wrong length for its type, and a reply that
answers another question are each a negative `DNS_ERR_*` code, and the work is
linear in the reply's length. Both files are read into tables of fixed size
whose overflow is dropped and counted. Only the program's own mistakes — a
window outside its array, a port or ID that is not 16 bits, a query
`dnsBuildQuery` did not write — panic. Four properties are recorded as
accepted (DNS-1 to DNS-4); none is counted. The panics are not yet pinned by a
fixture of their own ([Not pinned](#not-pinned)).

## Scope

| File | Functions |
| --- | --- |
| `std/net/dns-message.ts` | `dnsBuildQuery`, `dnsParseReply`; `DnsReply`; the helpers `dnsCheckLength`, `dnsLower`, `dnsReadName`, `dnsSameName`, `dnsCopyName`, `dnsKeepAddress` |
| `std/net/dns-config.ts` | `dnsParseAddress`, `dnsParseResolvConf`, `dnsParseHosts`, `dnsHostsFind`; `DnsConfig`, `DnsHosts`; the helpers `dnsConfigCheckWindow`, `dnsIsBlank`, `dnsHexValue`, `dnsParseIpv4`, `dnsParseIpv6`, `dnsIsIpv4`, `dnsLineEnd`, `dnsCommentCut`, `dnsWordEnd`, `dnsWordIs`, `dnsOption`, `dnsAddSearch`, `dnsResolvLine`, `dnsAddHostName`, `dnsHostsLine`, `dnsHostNameIs` |

Out of scope: the socket, the choice of ID and source port, retries, the
search list's application and the TCP fallback, which are the resolver's
(`std/net/dns-resolver.ts`, the next stage, with its own record); reading the
files from disk; DNSSEC, which a stub resolver that trusts its recursive server
does not validate; and every record type but A, AAAA and CNAME, which is read
past.

## Threat model

The attacker is anyone who can put a datagram on the resolver's port: an
off-path spoofer guessing the ID, or the recursive server itself. They write
every byte of a reply in any length up to the datagram. A win is a panic, a
loop or work beyond linear, a read outside `msg[0, len)`, an address accepted
for a name the program did not ask for, or a reply to another question read as
this one's. The files are written by the machine's administrator or by a
DHCP client, and a hostile or broken one may be any size and contain anything;
a win there is a panic, a table that grows past its cap, or a literal read in
a way the C library would not (octal, a zone). The program calling the module
is trusted; its mistakes panic.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| DNS-1 | Low | `std/net/dns-message.ts` (`dnsParseReply`) | The codec checks the ID, the QR bit, the opcode and the question, but not who sent the datagram: an off-path spoofer that guesses the 16-bit ID and the source port has a reply read as the answer. | **Accepted.** The source address and port are the socket's, and the resolver stage draws the ID and the port at random and reads from a connected socket; the codec has no address to compare. |
| DNS-2 | Low | `std/net/dns-message.ts` (`dnsBuildQuery`, `dnsSameName`) | The question's name is written as the program gave it and compared without case, so the 0x20 bits of the name add no entropy against a spoofer. | **Accepted.** RFC 4343 asks for comparison without case, and a recursive server that does not echo the case exactly would make a case-exact check refuse true answers. |
| DNS-3 | Low | `std/net/dns-message.ts` (`dnsParseReply`) | A CNAME whose owner is the chain's end moves the chain to any target, and an address for that target is kept, whatever zone it is in. A lying recursive server can answer anything. | **Accepted.** The recursive server is the stub's trust anchor, as it is glibc's and musl's; what the chain prevents is an address for a name off the chain, which is read past (`built CNAME off the chain: no address`). |
| DNS-4 | Low | `std/net/dns-config.ts` (`dnsParseIpv4`, `dnsParseIpv6`) | The address literal is read by the module's own parser, not by `nish:net`'s `netAddress`, which a std module that must compile on `wasm32` may not import. Two readers of one literal could drift. | **Accepted.** Both are strict: four decimal parts without a leading zero, or RFC 4291 §2.2's text form with at most one `::` and an optional IPv4 tail, no zone and no brackets; every edge is pinned (`ipv4: *`, `ipv6: *`). |

## Properties verified

Each property below is pinned by a line of the fixture's `expected.out`, so
the check that fails when one stops holding is
`link/std_dns_message: exits with 0 and stdout matches expected.out` or
`link/std_dns_config: exits with 0 and stdout matches expected.out`; the line
names are quoted after each property. Both fixtures also run as `wasm32`, by
`` link/std_dns_message: the `--profile wasi` build (sysroot ${WASI_SYSROOT}) prints expected.out under Node's WASI ``
and its `std_dns_config` twin, so neither module reaches a `nish:*` builtin.

**A query is a name of labels, or a code** (`query: *`). `dnsBuildQuery`
refuses an empty name or label (`DNS_ERR_EMPTY_LABEL`), a label over 63 bytes
(`DNS_ERR_LABEL_LONG`), a name over 253 bytes before its optional trailing dot
(`DNS_ERR_NAME_LONG`), a byte outside `!` to `~` (`DNS_ERR_NAME_BYTE`), a type
other than A or AAAA (`DNS_ERR_QTYPE`) and an `out` one byte short
(`DNS_ERR_SPACE`); `DNS_QUERY_MAX_BYTES` (271) always fits ("a 253-byte name
fills 255 bytes of wire form", "exactly room").

**A reply must answer the query** (`malformed: QR clear`, `opcode 2`,
`another ID`, `no question`, `two questions`, `another question name`,
`another question class`, and `captured example.com A against an AAAA query`).
The ID, QR, opcode 0, one question and its name, type and class are checked
before any record is read. The name is compared without case
(`captured example.com A, question as EXAMPLE: the same name`).

**Every name is bounded** (`dnsReadName`). A pointer must point before the
start of the run of labels that holds it and after the header, so each hop
moves backwards (`a forward pointer`, `a pointer into the header`,
`a self-pointer`, `a label then a pointer back to its start`,
`a two-pointer loop`: `DNS_ERR_POINTER`). Sixteen hops are read and a
seventeenth is `DNS_ERR_HOPS` (`built: a name of 16 hops`,
`malformed: a name of 17 hops`). A name of 255 bytes in wire form is read and
one of 256, directly or by a pointer, is `DNS_ERR_NAME_LONG`
(`built: an owner of exactly 255 bytes`, `an owner of 256 bytes`,
`a name past 255 bytes by a pointer`). The retired label types `0x40` and
`0x80` are `DNS_ERR_LABEL_TYPE`.

**No count is believed past the bytes** (`65,535 answers in 61 bytes`,
`an additional count past the end`: `DNS_ERR_COUNT`). The three record counts
together may not exceed what the bytes after the question could hold at 11
bytes a record, so the answer loop runs at most `len / 11` times. A record's
fixed fields or RDATA past the end is `DNS_ERR_SHORT` or `DNS_ERR_RDATA`
(`a record's fixed fields cut short`, `the last RDATA one byte past the end`,
`RDLENGTH 65,535`); an A that is not 4 bytes or an AAAA that is not 16 is
`DNS_ERR_RDLENGTH`, and a CNAME's target must fill its RDATA exactly and is
read inside it (`a CNAME whose target does not fill its RDATA`,
`… runs past its RDATA`, `… points forwards`).

**Only the chain's addresses are kept** (`captured www.microsoft.com A`,
`built mixed records`, `built CNAME off the chain`). The chain starts at the
question's name; a record of another owner, class, or type is read past; the
first `DNS_MAX_ANSWERS` (8) addresses are kept and the rest counted
(`captured outlook.com A: the ninth dropped and counted`). A TTL above
2^31 − 1 reads as 0 (RFC 2181 §8).

**The server's answers are the program's to read** (`captured
nxdomain.invalid A`, `built SERVFAIL`, `built REFUSED`, `built TC reply`).
NXDOMAIN, SERVFAIL and REFUSED are answered as themselves with no record read;
FORMERR, NOTIMP and every other RCODE are `DNS_ERR_RCODE`; TC set reads no
record and sets `truncated`.

**Mutation does not break a bound** (`mutation: no reply keeps more than
DNS_MAX_ANSWERS`). 4000 seeded mutations of the captured replies (one to
four bytes set at random, the copy sometimes cut short) each answer a status
or a code; the tally of codes is pinned
line for line in `expected.out`, so a change in what any mutation answers is
seen.

**An address literal is strict** (`ipv4: *`, `ipv6: *`, `literal: *`).
`010.0.0.1`, `1.2.3`, `256.0.0.1`, a sign, `fe80::1%eth0`, `[::1]`, two `::`
and nine groups are refused; a refusal writes nothing to `out`, and only the
window is read.

**`resolv.conf` fills fixed tables** (`resolv: *`). At most
`DNS_MAX_SERVERS` (3) servers and `DNS_MAX_SEARCH` (6) domains in
`DNS_MAX_SEARCH_BYTES` (256) are kept, the rest counted; `ndots`, `timeout`
and `attempts` saturate while their digits are read and are then clamped
("a hundred digits clamp, never wrap"); a line over `DNS_CONFIG_MAX_LINE`
(1024) bytes is skipped whole and counted ("a line of 1025 bytes skipped and
counted", "a line of 1024 bytes read"); a file with no usable server gives
127.0.0.1 and ::1.

**`hosts` fills fixed tables** (`hosts: *`). At most `DNS_HOSTS_MAX_ENTRIES`
(256) addresses, `DNS_HOSTS_MAX_NAMES` (1024) names and
`DNS_HOSTS_MAX_NAME_BYTES` (16384) bytes of them are kept, the rest counted;
a name over 253 bytes is dropped and counted. A lookup compares without case
and without a trailing dot, answers file order, stops at `max`, and answers A
for an `::ffff:` address and AAAA for any other.

## Not pinned

The panics — `dnsBuildQuery: the id … is not 16 bits`,
`dnsParseReply: the port … is not 16 bits`,
`dnsParseReply: the query is not one dnsBuildQuery wrote`,
`…: the length is outside the array`, `…: the window is outside the array`,
`dnsParseAddress: at is outside out`, and `dnsHostsFind`'s type, room and
port — are each a guard on the caller's arguments, reached by no byte of a
reply or a file. A panic exits the program, so each needs a fixture of its own
with an `expected.stderr`, as `std_url_window` is; this stage's fixtures are
`std_dns_message` and `std_dns_config` only. Their fixtures are a follow-up.
