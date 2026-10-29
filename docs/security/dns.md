# Security record: `nish/net/dns` — the stub resolver, its wire codec and its files

The record of the stub resolver (#986, #479), in two stages. The first is the DNS
message codec (RFC 1035 §4, with RFC 2181 and RFC 4343's readings) that writes
one A or AAAA question and reads the reply to it, and the readers of
`/etc/resolv.conf` and `/etc/hosts` the resolver starts from. It says what each
module refuses and with what, what it caps and where, and the test that pins
each property. It is written with the code, against `main` at `2cdef4f`, and
cites functions rather than lines. The second stage, the resolver that sends
the queries and the client that drives it over sockets, is
[The resolver](#the-resolver), written against `20ce936`.

**Result.** Nothing a peer or a file sends panics, loops or allocates: a
compression loop, a pointer forwards or into the header, a seventeenth hop, a
name past 255 bytes, a count larger than the message holds, a record whose
RDATA runs past the end or has the wrong length for its type, and a reply that
answers another question are each a negative `DNS_ERR_*` code, and the work is
linear in the reply's length. Both files are read into tables of fixed size
whose overflow is dropped and counted, and a literal is parsed into the
table's own sixteen-byte buffer, so a file of any length leaves the arena where
it found it (`flat arena: 1000 nameserver lines and 1501 hosts lines allocate
nothing`). The one allocation is the exported `dnsParseAddress`'s, sixteen
bytes a call, as its documentation says; the file parsers do not call it. Only the program's own mistakes — a
window outside its array, a port or ID that is not 16 bits, a query
`dnsBuildQuery` did not write — panic. Four properties are recorded as
accepted (DNS-1 to DNS-4); none is counted. The panics are not yet pinned by a
fixture of their own ([Not pinned](#not-pinned)). The resolver stage closes
DNS-1's follow-up and fixed one Medium finding of its own, DNS-5.

## Scope

| File | Functions |
| --- | --- |
| `std/net/dns-message.ts` | `dnsBuildQuery`, `dnsParseReply`; `DnsReply`; the helpers `dnsCheckLength`, `dnsLower`, `dnsReadName`, `dnsSameName`, `dnsCopyName`, `dnsKeepAddress` |
| `std/net/dns-resolver.ts` | `DnsResolver` (`start`, `nextOutgoing`, `receive`, `receiveStream`, `fail`, `tick`, `nextDeadlineNanos`, `result`, `cancel`, `active`); the helpers `dnsResolverCheckQuery`, `dnsResolverIsLocalhost`, `dnsResolverLoopback`, `dnsResolverLiteral`, `dnsResolverFinishNow`, `dnsResolverFinish`, `dnsResolverStop`, `dnsResolverGather`, `dnsResolverNextCandidate`, `dnsResolverCandidate`, `dnsResolverBegin`, `dnsResolverAsk`, `dnsResolverSend`, `dnsResolverServerFailed`, `dnsResolverAnswer`, `dnsResolverNameLength`, `dnsResolverSameName`, `dnsResolverDone` |
| `std/net/dns.ts` | `DnsClient` (`tokens`, `owns`, `start`, `result`, `cancel`, `ready`, `tick`, `timeoutMs`, `pump`, `nextOutgoing`), `resolveHost`, `dnsLookupWith`; the helpers `dnsClientClose`, `dnsClientFail`, `dnsClientIsV4`, `dnsClientSendUdp`, `dnsClientOpenTcp`, `dnsClientReadDatagrams`, `dnsClientWrite`, `dnsClientReadStream` |
| `std/net/dns-config.ts` | `dnsParseAddress`, `dnsParseResolvConf`, `dnsParseHosts`, `dnsHostsFind`; `DnsConfig`, `DnsHosts`; the helpers `dnsConfigCheckWindow`, `dnsIsBlank`, `dnsHexValue`, `dnsParseIpv4`, `dnsParseIpv6`, `dnsIsIpv4`, `dnsLineEnd`, `dnsCommentCut`, `dnsWordEnd`, `dnsWordIs`, `dnsOption`, `dnsAddSearch`, `dnsResolvLine`, `dnsAddHostName`, `dnsHostsLine`, `dnsHostNameIs` |

Out of scope: `nish:net`'s sockets and readiness loop, which have their own
record; DNSSEC, which a stub resolver that trusts its recursive server
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
| DNS-1 | Low | `std/net/dns-message.ts` (`dnsParseReply`) | The codec checks the ID, the QR bit, the opcode and the question, but not who sent the datagram: an off-path spoofer that guesses the 16-bit ID and the source port has a reply read as the answer. | **Accepted.** The source address and port are the socket's, which the codec never sees. The resolver stage draws a random ID for every send, opens a fresh socket on a kernel-chosen port for every try, and drops a datagram from any address but the server's ([The resolver](#the-resolver)). |
| DNS-2 | Low | `std/net/dns-message.ts` (`dnsBuildQuery`, `dnsSameName`) | The question's name is written as the program gave it and compared without case, so the 0x20 bits of the name add no entropy against a spoofer. | **Accepted.** RFC 4343 asks for comparison without case, and a recursive server that does not echo the case exactly would make a case-exact check refuse true answers. |
| DNS-3 | Low | `std/net/dns-message.ts` (`dnsParseReply`) | A CNAME whose owner is the chain's end moves the chain to any target, and an address for that target is kept, whatever zone it is in. A lying recursive server can answer anything. | **Accepted.** The recursive server is the stub's trust anchor, as it is glibc's and musl's; what the chain prevents is an address for a name off the chain, which is read past (`built CNAME off the chain: no address`). |
| DNS-4 | Low | `std/net/dns-config.ts` (`dnsParseIpv4`, `dnsParseIpv6`) | The address literal is read by the module's own parser, not by `nish:net`'s `netAddress`, which a std module that must compile on `wasm32` may not import. Two readers of one literal could drift. | **Accepted.** Both are strict: four decimal parts without a leading zero, or RFC 4291 §2.2's text form with at most one `::` and an optional IPv4 tail, no zone and no brackets; every edge is pinned (`ipv4: *`, `ipv6: *`). |
| DNS-5 | Medium | `std/net/dns.ts` (`dnsClientReadDatagrams`) | `DnsClient.ready` read datagrams from a query's socket until none was waiting, so a flood sent faster than the client parsed it held the caller's loop inside `ready` for as long as it lasted: every other descriptor on the loop starved. | **Fixed.** One `ready` reads at most `DNS_CLIENT_MAX_DATAGRAMS` (32); the loop is level-triggered, so the rest wait for the next `pollWait`. Before: `flood: one ready reads DNS_CLIENT_MAX_DATAGRAMS` failed with 40 of 40 forged datagrams read in one call; after, 32, and the genuine reply behind the flood still answers (`flood: the genuine address stands`). |

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
`a two-pointer loop entered by a backward hop`: `DNS_ERR_POINTER`). Sixteen hops are read and a
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
`DNS_ERR_RDLENGTH`, and a CNAME on the chain (its owner the chain's end) must
have a target that fills its RDATA exactly and is read inside it; a CNAME off
the chain is read past by its RDLENGTH like any other record (`a CNAME whose target does not fill its RDATA`,
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
record and sets `truncated`, and its counts are not held to the bytes that
arrived, since they describe the records the server could not fit (`built TC
reply, 255 answers claimed`).

**Mutation does not break a bound** (`mutation: every round answers a status
or a documented code`). 4000 seeded mutations of the captured replies (one to
four bytes set at random, the copy sometimes cut short) each answer a reply
status or a code `dnsParseReply` documents, none panics, none keeps more than
`DNS_MAX_ANSWERS` addresses and a TC reply keeps none (`mutation: every round
keeps at most DNS_MAX_ANSWERS, and none on TC`); the tally of
statuses and codes is the one `mutation tally:` line in `expected.out`, so a
change in what any mutation answers is seen.

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

## The resolver

`DnsResolver` is the core: it holds each lookup's queries, writes the packets
to send, reads the bytes that arrive and keeps the deadlines, but never opens a
socket, never reads a clock, a file or the random source, and never blocks; the
caller passes the time, the bytes and each query's ID. `DnsClient` drives it
over `nish:net` on the caller's own loop; `resolveHost` and `dnsLookupWith`
run a loop of their own, and `resolveHost` alone reads `/etc/resolv.conf` and
`/etc/hosts`.

**Threat model.** The attacker is anyone who can send to the client's
sockets: an off-path spoofer who must guess the server's address, the source
port and the ID, an on-path observer who can answer first, or the recursive
server itself, which may reply slowly, truncate, refuse, loop its CNAMEs or
drip a TCP reply a byte at a time. A win is an address the program did not ask
for accepted as the answer, a lookup that never ends, state or an arena that
grows with what the peer sends, or the caller's loop held inside the client.
The program driving the core is trusted; its mistakes panic.

**Each property is pinned by a line of a fixture's `expected.out`.** The checks
are `link/std_dns_resolver: exits with 0 and stdout matches expected.out` (the
core against scripted packets, no socket), `link/std_dns: exits with 0 and
stdout matches expected.out` (the client against a Nish DNS server on
loopback) and `link/std_dns_soak: exits with 0 and stdout matches
expected.out`; the line names are quoted after each property.

**A forged reply is dropped and the true one still answers.** A datagram from
an address or port other than the server's is `droppedSource`, another ID
`droppedId`, another question `droppedQuestion`, a malformed one
`droppedMalformed`; none ends the query (`drop: a reply from the server's
address on another port`, `drop: a reply from another address`, `drop: a reply
with another ID`, `drop: a reply to another question`, `drop: a malformed
reply`, `drop: none of them ended the query`, `drop: the true reply still
answers`; over sockets, `spoof: another port is droppedSource`, `spoof: another
ID is droppedId`, `spoof: another question is droppedQuestion`, `spoof: the
genuine address stands`). A reply after the query is done, or a datagram once
it moved to TCP, is counted and not read (`drop: a reply after the query is done
is counted, not read`, `tc: a datagram once the query moved to TCP is dropped`),
and a server that failed is not heard from again (`servfail: the first server's
late reply is dropped by its source`). A reply that passes those checks with an
RCODE the resolver does not read, FORMERR or NOTIMP, fails the server at once
rather than waiting out its deadline (`formerr: the next server is asked at
once`, `formerr: it is not counted as malformed`, `notimp: fails the server
too`).

**The ID and the source port vary** (DNS-1). Each send carries the ID the
caller gives `nextOutgoing`, a TCP retry a new one (`udp: the A query carries
the ID it was drawn with`, `udp: the AAAA query carries its own`, `tc: with a
new ID`); `DnsClient` draws it from `crypto.getRandomValues` and opens every
UDP try on a fresh, kernel-chosen port (`vary: IDs differ between queries`,
`vary: source ports differ between queries`). The core takes the ID rather than
drawing it so that it compiles on `wasm32`, where the random source is the
host's.

**Every lookup ends.** Each try has a deadline of the configured `timeout`;
`tick` past it moves the query to the next server, and after `attempts` rounds
of every server the lookup is `DNS_RESOLVE_NO_ANSWER` (`timeout: nothing before
the deadline`, `timeout: both queries at the deadline`, `timeout: a dead
server's queries go to the next one`, `attempts: each server, then each again,
then no more`, `attempts: every try exhausted is DNS_RESOLVE_NO_ANSWER`,
`attempts: no deadline is left`; `dead server: the next one answers`,
`attempts: NO_ANSWER after every try`). A TCP reply dripped slowly is held to
the same deadline (`tc: a slow TCP reply is not ended before its deadline`,
`tc: a slow TCP reply is ended by its deadline`). `dnsLookupWith` gives up at
its own `timeoutMs` (`timeout: dnsLookupWith gives up`).

**TC moves the query to TCP, once.** `reply.truncated` sends the same question
over TCP with a new ID to the same server (`tc: reply.truncated sends the query
over TCP`, `tc: big.test answered over TCP`). On the stream, a length prefix
under 12 or over `DNS_TCP_MAX_REPLY` (16384), a reply still truncated, a reply
to another ID and a refused or broken connection each fail the server, which a
stream cannot recover from, and the next server is asked over UDP (`tc: a length
under 12 fails the server, and the next is asked over UDP`, `tc: a length over
DNS_TCP_MAX_REPLY fails the server, and the next is asked over UDP`, `tc: a
reply still truncated fails the server, and the next is asked over UDP`, `tc: a
reply with another ID fails the server, and the next is asked over UDP`, `tc: a
refused or broken connection fails the server`). Bytes after the reply is whole
are ignored (`tc: bytes after the query is done are ignored`). `DnsClient`
stops reading a stream once the core has ended its try, so a hang-up seen on
that connection is not held against a next try that reopens on the same fd. A UDP read is at
most `DNS_UDP_MAX_REPLY` (4096) bytes; a longer datagram is cut, fails to parse
and is dropped.

**A CNAME chain is bounded.** A chain the reply leaves open is asked after, the
same type, at most `DNS_RESOLVER_MAX_CNAME_HOPS` (8) queries; one hop more, or a
chain back to the name asked, is `DNS_RESOLVE_CNAME` (`cname: a chain of
DNS_RESOLVER_MAX_CNAME_HOPS queries answers`, `cname: one hop more is
DNS_RESOLVE_CNAME`, `cname: 9 hops asked at most DNS_RESOLVER_MAX_CNAME_HOPS
queries`, `cname: a chain back to the name asked is DNS_RESOLVE_CNAME`, `cname:
and asked it once more, not again`). A loop that closes inside one reply never
reaches the chain's end, so the codec keeps no address and it reads as NODATA.

**The search list is bounded.** A name with fewer dots than `ndots` is tried
under each suffix and then alone, one at or over it first; a trailing dot is
the name alone; NXDOMAIN moves to the next candidate and NODATA stops the
search, as musl's does, since the name exists; NXDOMAIN for one family with no
server reached for the other moves on too, keeping that error should no later
candidate answer, so one unreachable family cannot end the search on the first
candidate (`search: NXDOMAIN and no server for the other family move on`,
`search: and the name under a later domain resolves`, `search: with no later
answer, the unreachable family's error stands`). The NXDOMAIN that moves it is
the current name's own: each query clears it as it asks a new name, so an
earlier candidate's, or an earlier lookup's in the same slot, cannot carry the
search past a name that exists (`search: NODATA and an unreachable family after
an NXDOMAIN candidate is DNS_RESOLVE_NO_ANSWER`, `search: with no third
candidate asked`, `slot reuse: its unreachable servers are
DNS_RESOLVE_NO_ANSWER`, `slot reuse: with no second candidate asked`); a suffix that makes the name
over 255 bytes is skipped (`search: under ndots, each suffix and then the
name`, `search: at ndots, the name first`, `search: a trailing dot is the name
alone`, `search: NODATA is DNS_RESOLVE_NOT_FOUND`, `search: and stops the
search, since the name exists`, `search: a suffix that makes the name over 255
bytes is skipped`).

**No packet for a name the machine answers.** `localhost`, a name under it and
an address literal answer at once, and a name in `hosts` answers from the
table with TTL 0; `xlocalhost` and `localhost.example` are asked of the server
A name with an empty label under it, `.localhost` or `x..localhost`, is
refused (`localhost: still no packet sent`, `localhost: xlocalhost is not it, and is
asked of the server`, `localhost: .localhost is not it`, `localhost: nor
x..localhost`, `literal: no packet sent`, `hosts: no packet sent`). Over
sockets, a `DnsClient` answering `localhost` and a hosts name opens no socket,
and the server, drained after every blocking call, saw no query (`no packet:
the client opened no socket`, `no packet: the server saw nothing`); both fail
when either short-circuit is removed.

**State is fixed at construction.** A resolver holds 1 to
`DNS_RESOLVER_MAX_LOOKUPS` (64) lookups of two queries each, every buffer sized
when it is made; a lookup past them is `DNS_RESOLVE_BUSY` (`busy: every slot
taken is DNS_RESOLVE_BUSY`, `busy: even for localhost`), a finished or
cancelled one frees its slot and owes its sockets a close (`cancel: its sockets
are owed a close`, `cancel: its slot is free`, `hosts: every answered slot is
free once read`). A lookup keeps at most `DNS_RESOLVE_MAX_ADDRESSES` (16). The
arena does not move over 2,000 lookups past a warm-up (`soak: Arena.used() flat
over 2000 lookups past warm-up`).

**The loop is never held** (DNS-5). One `DnsClient.ready` reads at most
`DNS_CLIENT_MAX_DATAGRAMS` (32) datagrams (`flood: one ready reads
DNS_CLIENT_MAX_DATAGRAMS`, `flood: every forged datagram is droppedSource`);
a TCP read stops at `DNS_TCP_MAX_REPLY` and its two length bytes. A
`pollWait` that fails inside `resolveHost` or `dnsLookupWith` cancels the
lookup and answers its errno, rather than spinning until the deadline. Every
counter saturates at 2,147,483,647, so a long-lived client's counts never wrap
negative.

**The configuration files are read whole.** `resolveHost` reads
`/etc/resolv.conf` and `/etc/hosts` with `readFileBytesSync`, which has no
bounded form, and `nish:fs` has no size call to check first. Both files are
root-owned on every system the client runs on, and the parsers keep at most
`DNS_MAX_SERVERS` servers, `DNS_MAX_SEARCH` domains and
`DNS_HOSTS_MAX_ENTRIES` hosts entries, whatever the file's length; only the
read itself grows with the file. Accepted; a caller who distrusts the files
reads them itself and calls `dnsLookupWith`.

**The core reaches no capability.** `dns-resolver.ts` imports no `nish:*`
module and builds for `wasm32`
(`` link/std_dns_resolver: the `--profile wasi` build (sysroot ${WASI_SYSROOT}) prints expected.out under Node's WASI ``).
A program that drives it on its own loop reaches `net` and `entropy` only,
and one that calls `resolveHost` `fs.read` and `clock` as well
(`link/std_dns_caps: --emit-capabilities matches expected.caps.json byte for
byte`).

## Not pinned

The panics — `dnsBuildQuery: the id … is not 16 bits`,
`dnsParseReply: the port … is not 16 bits`,
`dnsParseReply: the query is not one dnsBuildQuery wrote`,
`…: the length is outside the array`, `…: the window is outside the array`,
`dnsParseAddress: at is outside out`, `dnsHostsFind`'s type, room and
port, and the resolver's — `DnsResolver: … lookups is outside 1 to 64`,
`DnsResolver.start: the port … is not 16 bits`, `DnsResolver.nextOutgoing: the
id … is not 16 bits`, `… out, to or meta is too short`, `DnsResolver.receive:
len is outside buf, or from is shorter than 18 bytes`,
`DnsResolver.receiveStream: len is outside buf`, `DnsResolver.…: … is not a
query`, `DnsResolver.result` and `cancel` for a lookup not in progress or an
`out` with no room, `DnsClient: a token base of … is negative`,
`DnsClient.ready: the token … is not the client's` and `resolveHost: out or
ttls has no room for DNS_RESOLVE_MAX_ADDRESSES` — are each a guard on the caller's arguments, reached by no byte of a
reply or a file. A panic exits the program, so each needs a fixture of its own
with an `expected.stderr`, as `std_url_window` is; these stages' fixtures do
not include one. Their fixtures are a follow-up.

A forged reply from on the path, which sees the ID and the port, is not
stopped by any check here: a stub resolver that does not validate DNSSEC trusts
the path to its server, as glibc's and musl's do (DNS-3). A flood on the
loopback interface can fill the socket's receive buffer and drop the true
reply; the try then times out and the next server is asked, which the
`timeout:` and `dead server:` lines pin as the recovery.
