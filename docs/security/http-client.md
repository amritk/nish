# Security record: the blocking HTTP/1.1 client

The record of `nish/net/http-client`, the blocking client a command-line
program fetches with: `httpFetch`, `HttpClient` and the proxy helpers. It says
what the client sends and refuses, what bounds every wait and every body, what
a redirect may carry to another origin, how the proxy settings are read, and
the test that pins each property. It is written with the code, at base commit
`b21a21c0`, rather than after an audit. It names functions rather than lines,
so it holds at any commit that has them.

**Result.** Every byte the client writes goes through `http1RequestHead` and
every byte it reads through `Http1ResponseParser`, so the framing guarantees of
[`http1-client.md`](http1-client.md) hold here unchanged: a caller's string
cannot end a line, and a smuggled response is refused, never repaired. Every
wait has a deadline, and `totalTimeoutMs` bounds a whole fetch, so a server
that drips its body cannot hold one forever. A body is capped by
`maxBodyBytes` and by what `readAll` is asked for. A redirect is followed only
when asked, never from https to http, and to another origin only when asked
too, without the caller's credentials. `HTTP_PROXY` is ignored under CGI. A
connection holding a byte past its last response is never used again, and an
error names a URL without its password or query. Seven findings were fixed
while the module was written (HF-1 and HF-4 to HF-9, Low); two are open (HF-2
and HF-3, Low). https is TLS 1.3 through `TlsRecordClient`: the
server's chain is checked under the caller's roots, or the system's, at the
wall clock's time and for the URL's host before a byte of the request is
sent; no root to trust is a refusal before any connection; there is no switch
that turns the check off; and a body is whole only once the server's
`close_notify` or its framing says so. Revocation is not checked
([PKI-17](crypto-pki.md#pki-17-medium-revocation-is-not-checked)).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-client.ts` | `httpFetch`, `httpErrorName`, `httpChooseProxy`, `httpProxyFor`, `httpNoProxyMatch`; `HttpRequest` (`header`), `HttpOptions`, `HttpResponse` (`header`), `HttpBodyReader` (`read`, `readAll`); `HttpClient` (`setProxies`, `fetch`, `close`, `exchange`, `open`, `tunnel`, `send`, `head`, `pump`, `fill`, `writeAll`, `dial`, `wait`, `watch`, `unwatch`, `quiet`, `leftover`, `overdue`, `readDeadline`, `hostAllowed`, `drop`, `drain`, `readBody`, `refuseBody`, `failWait`, `refuse`, `fail`, `loadTrust`, `secure`, `receiveTls`, `flushTls`, `failTls`, `readRaw`, `writeRaw`); and the helpers (`httpClientParser`, `httpClientIsRedirect`, `httpClientIdempotent`, `httpClientDropField`, `httpClientLower`, `httpClientTrim`, `httpClientTrimDots`, `httpClientPort`, `httpClientHostText`, `httpClientUrlText`, `httpClientRedact`, `httpClientProxyUrl`, `httpClientProxyAuth`, `httpClientBodyCap`, `httpClientTotalMs`, `httpClientMaxRedirects`); `hostAllowed` and the policy branches of `open`, `dial` and `fetch` are [`outbound.md`](outbound.md)'s |

Out of scope: the request writer and response parser of
`std/net/http1-client.ts` ([`http1-client.md`](http1-client.md)), the URL
parser and resolver of `std/net/url.ts` ([`url.md`](url.md)), the stub
resolver of `std/net/dns-resolver.ts` ([`dns.md`](dns.md)), and the socket and
poll builtins of the runtime ([`runtime.md`](runtime.md)), the TLS 1.3
handshake and record layer of `std/crypto/tls*.ts` ([`tls.md`](tls.md)), and
the chain, name and validity checks and the root loading of
`std/crypto/pki*.ts` ([`crypto-pki.md`](crypto-pki.md)). This module calls
them and trusts what they answer; what it adds is the order of the calls, the
deadlines between them, and the policy for keep-alive, redirects, proxies,
which roots are trusted and when a TLS connection has ended.

## Threat model

The attacker is the server, a server a redirect points to, a proxy, or
anything on the path to them: every byte read is theirs, split anywhere,
delayed by any amount, and the connection may close at any byte. They may
answer with a redirect anywhere, a body without end, interim responses, or
nothing. A win is a fetch that never ends, memory a server can make the client
spend without bound, a caller's credential sent to an origin it was not meant
for, a request split or rewritten by a value the server chose (a `Location`),
a body cut short taken for a whole one, a POST sent twice, or a proxy setting
the attacker controls (the CGI `Proxy:` header). The program driving the
client, its options and its environment are trusted; so are the proxy
variables outside CGI, the root files (`rootsPemPath`, `SSL_CERT_FILE`,
`SSL_CERT_DIR`, the system bundle), and the wall clock a certificate's
validity is judged by. Over https, a win is also a connection to a server
whose certificate the roots do not vouch for, for that host, now; a request
sent before the server is authenticated; or a truncation by the path taken
for the end of a body.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HF-1 | Low | `std/net/http-client.ts` (`HttpClient.readBody`) | A reader whose body had ended answered the client's latest error, not its own: once a later fetch failed, a body already read to its end answered that failure on its next `read`, so a program could take a whole body for a failed one, and a failed one could answer 0 after a later success. | **Fixed** before the module shipped: the client keeps the body's own failure in `bodyError`, set where that body fails and cleared when the next one opens. Before, `a body read to its end answers 0 again` failed; after, it passes. |
| HF-2 | Low | `std/net/http-client.ts` (`HttpClient.fetch`) | With `crossOriginRedirects` set, a hop to another origin drops `Authorization`, `Proxy-Authorization`, `Cookie` and `Host`, but a credential the caller sends under another name (`X-Api-Key`, `Private-Token`) goes on to the new origin. | **Open, accepted.** The client cannot know which of a caller's fields is a secret. The option is off by default, and the guide says to leave it off for a request that carries a credential in a field of its own. |
| HF-4 | Low | `std/net/http-client.ts` (`httpFetch`) | `httpFetch` closed its client only when the fetch failed. After a success its connection stayed open, over https without a `close_notify`, until the process exited, and nothing could reach the client to close it: a CLI looping over `httpFetch` held a socket for every fetch, and the server never learned the session ended cleanly. | **Fixed** before the module shipped: `httpFetch`'s client is marked `once` and `release` closes it whole when its body ends, fails, or is refused past `readAll`'s limit. Before, `and once its body is read, it ends the connection with a close_notify` (in `net_http_fetch_tls`) failed; after, it passes. |
| HF-5 | Low | `std/net/http-client.ts` (`HttpClient.send`) | A `Proxy-Authorization` the caller set went to the origin whenever the request did not go through an http proxy: fetched directly, or inside a CONNECT tunnel, whose CONNECT carries only the proxy URL's own userinfo. The proxy's credentials reached a server that has no use for them. | **Fixed** before the module shipped: `send` drops the caller's `Proxy-Authorization` unless the request goes to an http proxy. Before, `a caller's Proxy-Authorization never goes to an origin fetched directly` failed; after, it passes. |
| HF-6 | Low | `std/net/http-client.ts` (`HttpClient.drop`) | A body whose client closed it before its end (`close()` on a cancel path, or any drop that keeps the generation) answered 0 on its next `read`, so `readAll` took the bytes read so far for the whole body. A stale reader also overwrote the client's error with its own, losing the later fetch's failure before the program reported it. | **Fixed** before the module shipped: `drop` sets the open body's `bodyError` to `HTTP_E_IO`, and a stale reader answers `-HTTP_E_IO` without touching the client. Before, `a body its client closed before its end answers an error, never 0` and `a stale body's read leaves the later fetch's error in place` failed; after, they pass. |
| HF-7 | Low | `std/net/http-client.ts` (`HttpClient.readBody`, `open`) | A kept connection was used again with bytes past its last response on it: sent in the same segment as the response, or by the server while the connection sat idle. The next fetch on it read those bytes as its own response, one the server wrote before it saw the request, so a server out of step answered each request with the one before's answer. | **Fixed** before the module shipped: `release` closes a connection on which `leftover` finds a byte held by the parser or the TLS layer, and `open` reuses one only when `quiet`, a poll that does not wait, finds nothing to read on it. Before, `a response followed in its segment by another nobody asked for is read, and its connection dropped` and `and so is one whose server spoke while it sat idle` failed (the next fetch read the unasked-for `evil!`); after, they pass. |
| HF-8 | Low | `std/net/http-client.ts` (`HttpClient.fetch`, `open`) | `errorText` named a request URL, a redirect's `Location` and a proxy setting whole, so a password in the userinfo or a token in the query went wherever a program reports its errors, a log or a CI transcript. | **Fixed** before the module shipped: every URL an error names, the target of a request refused before it is sent included, goes through `httpClientRedact`, which builds it from the parsed URL's scheme, host, port and path alone and marks a query or fragment left out with `?...`; a text that does not parse, or has no host, is not echoed at all. Two scans of the raw text came first and each leaked: cutting at `?` before stripping the userinfo left a password holding a `?` or `#`, and stripping to the last `@` first deleted a query's `?` along with everything before an `@` in it, leaving its token (`http://h/p?email=a@b.com&token=T`). Only the parser tells a password's `@`, `?` or `/` from a query's. The redaction is of the URL the parser sees: a text that parses differently from what its writer meant is named as parsed, so in `http://admin:8080/s3cret@example.com/` the `8080` is a port and `/s3cret@example.com/` a path, which is echoed (`but a password that reads as a port leaves a valid URL, and its path is echoed as a path`). Before, `and the error names it without its password or query` (for a request URL and for a proxy setting) and `a refused Location is named without its password or query` failed; after, they pass, as do the checks for an `@` in a query, fragment or path, URLs whose password holds `://`, `/`, `?`, `#` or `@` after a non-numeric start, which do not parse, a redirect whose query holds an `@`, and a scheme-less or unparseable proxy setting. |
| HF-9 | Low | `std/net/http-client.ts` (`HttpClient.fill`, `writeRaw`) | `totalTimeoutMs` was checked only by a wait. A body whose next bytes were always on the socket before the client asked for them never waited, so a fetch read on past its deadline. | **Fixed** before the module shipped: `overdue` fails the fetch with `HTTP_E_TOTAL_TIMEOUT` before every read and every write once the deadline has passed. Before, `a body whose rest is already waiting is still cut off once totalTimeoutMs has passed` failed; after, it passes. |
| HF-3 | Low | `std/net/http-client.ts` (`HttpClient.fetch`, `send`, `dial`) | Each fetch makes its field arrays, its response, the response's copies of the parser's fields, the lookup's address arrays and its error text afresh, so they stay in the arena until the program resets it, as HC-1 records for the parser beneath. Bounded for each fetch by `maxRedirects + 1` heads of `HTTP_CLIENT_MAX_HEADERS` fields within the parser's caps. | **Open, accepted for now.** A long-running program fetches inside an arena it resets; a per-connection arena closes it with HC-1. |

## Fuzzing

Not fuzzed. The module parses no wire bytes of its own: the response goes
through `Http1ResponseParser`, which `tests/fuzz/targets/http1-client.ts`
fuzzes, and the URL and `Location` through `urlParse` and `urlResolve`, which
`url.md` covers. What it parses itself is trusted configuration: the proxy
variables and `NO_PROXY`, pinned by the checks below.

## Properties verified

Each property below is pinned by a check that fails if it stops holding. The
checks are in `tests/link/net_http_fetch/checks.ts`, run as
`link/net_http_fetch: exits with 0 and stdout matches expected.out` (the
template `link/${name}: exits with ${wantCode} and stdout matches
expected.out` in `tests/run.js`), and again under `--number-mode f64` as
`link/net_http_fetch_f64`; each check's own line is in `expected.out`.
The test is its own server: it listens on two loopback ports and runs itself
again as the client, so every byte both ways is the test's.

**What is sent is checked first.** A header value holding CR LF, and a method
that is not a token, are `HTTP_E_REQUEST` with nothing written (`a header
value with CR LF is refused before a byte is sent`, `and so is a method that
is not a token`); a URL that is not absolute http or https is `HTTP_E_URL`
(`an ftp URL is HTTP_E_URL`, `and so is a relative one`). The request line is
origin-form, and `Host` comes from the URL unless the caller gives one (`the
request line is origin-form, and Host comes first from the URL`, `a caller's
Host is sent in place of the URL's`); its `Proxy-Authorization` goes only to
an http proxy (HF-5). A body goes with its `Content-Length`
(`a POST body goes with its Content-Length`, `an empty body sends
Content-Length: 0, and no body sends none`).

**Framing is the parser's.** Two `Content-Length` fields that disagree are
`HTTP_E_PROTOCOL`, the parser's code named in `errorText` (`two
Content-Length fields that disagree are HTTP_E_PROTOCOL`, `and errorText
names the parser's code`); a body cut short by the close is an error, never a
whole body (`a body cut short by the close is an error, never a whole body`);
an interim response is read past (`a 103 before the response is read past`).
A response head past `maxHeaderBytes` is `HTTP_E_PROTOCOL`, and the same head
is read under a limit above it (`a response head past maxHeaderBytes is
HTTP_E_PROTOCOL`, `and read under a limit above it`).

**Every wait ends.** A server that never answers is `HTTP_E_READ_TIMEOUT`
after `readTimeoutMs` (`a server that never answers is HTTP_E_READ_TIMEOUT`,
`after readTimeoutMs`); a body dripped a byte at a time, each byte inside the
read timeout, is cut off by `totalTimeoutMs`, counted from the start of the
fetch (`a body dripped a byte at a time is cut off by totalTimeoutMs`, `after
totalTimeoutMs, counted from the start of the fetch`, `and the error says the
fetch ran past totalTimeoutMs`), and so is one whose rest is on the socket
before it is asked for (HF-9); a listener that never
accepts is `HTTP_E_CONNECT_TIMEOUT` (`a listener whose backlog is full is
HTTP_E_CONNECT_TIMEOUT`). A refused port and an unknown name have their own
codes (`a port nothing listens on is HTTP_E_REFUSED`, `a name that does not
exist is HTTP_E_DNS`). The connect budget is the lookup's and every address's
together, tried in turn: an address that drops the SYN uses up the whole
budget, so the addresses after it are never tried. A name whose first address
is black-holed fails with `HTTP_E_CONNECT_TIMEOUT` though a later one would
answer; `connectTimeoutMs` bounds that wait, and nothing races the addresses.

**Every body is capped.** A declared length past `maxBodyBytes` fails before a
byte of the body is read, and a chunked body as it passes the cap (`a
Content-Length past maxBodyBytes is HTTP_E_BODY_TOO_LARGE before the body is
read`, `and a chunked body is cut off as it passes maxBodyBytes`); `readAll`
refuses a body past its own limit and reads one exactly at it whole (`and so
is one past readAll's limit`, `while one exactly at the limit is read whole`).
A body that failed, cut short or refused, answers the same error on every later
read (`and the body answers that error again when read after it`, twice), and
a read never writes past the count it asked for (`a read asking for two bytes
of a longer body answers two`, `a body read two bytes at a time is read
whole`), and a read of none answers 0 without waiting (`an empty read answers
0 at once, waiting for nothing`). A stream is handed out as it arrives (`an event stream's first event is read
while the server holds the stream open`).

**Keep-alive cannot mix responses.** A second fetch reuses the connection
only once the first body is read (`the second fetch reused the first one's
connection`); a fetch while a body is unread closes the connection, and the
old reader answers an error rather than the next response's bytes (`a body
left unread answers an error once the next fetch starts`, `and the next fetch
went on a new connection`); a body read to its end answers 0 again (HF-1). A
stale reader leaves the later fetch's error alone, and a body its client
closed early answers an error (HF-6). A
kept connection the server closed while idle is seen closed before a request
is written on it, so the request goes on a new one, a POST included (`the
close is seen before a GET is sent, and it goes on a fresh connection`, `and
so does a POST, which no retry could send`). One the server closes under a
request, before a byte of the answer, is retried once on a new connection for
an idempotent method and never for a POST (`a GET a kept connection closes
under, before any byte of answer, is sent again on a new one`, the same for a
PUT and a DELETE, `a POST is not sent twice: it fails with HTTP_E_IO`); a
request whose answer was cut off part way, or that a kept connection never
answers, is not sent again (`a GET whose answer was cut off part way is not
sent again`, `nor one a kept connection never answers: it is
HTTP_E_READ_TIMEOUT`). Bytes past a response close its connection (HF-7). A response that says `Connection:
close` ends its connection even when the server leaves the socket open (`a
response that says Connection: close is read`, `and its connection is not used
again, though the server left it open`), so a POST after it is sent once, on a
new connection (`a POST after it goes on a new connection, with no retry
needed`).

**Redirects.** Not followed by default (`a redirect is not followed by
default`); followed, bounded by `maxRedirects` (`a redirect loop is
HTTP_E_TOO_MANY_REDIRECTS after maxRedirects`, `exactly maxRedirects
redirects are followed`, `and one more is HTTP_E_TOO_MANY_REDIRECTS`); refused to another origin, to
a scheme other than http or https, and from http to https unless
`crossOriginRedirects` is set (`a redirect to another origin is refused by
default`, `and so is one to an ftp URL`, `and one from http to https, which is
another origin`). Allowed to another origin, the hop drops `Authorization`,
`Proxy-Authorization` and `Cookie` and sends the new origin's `Host`
(`without Authorization, Proxy-Authorization or Cookie`, `with the new origin's Host and the caller's other fields`). A hop
from https to http is refused whatever the options say (`a redirect from
https to http is refused even with crossOriginRedirects`, below). The method and body
change as RFC 9110 §15.4 says (`a POST redirected by 303 becomes a GET without
its body`, `and so does one redirected by 302`, `307 keeps the method and the
body`, `and so does 308, its relative Location resolved`), a 302 turns only a POST
into a GET (`a 302 turns only a POST into a GET: a PUT keeps its method and
body`), and a HEAD stays a HEAD through a 303 (`a HEAD redirected by 303 stays
a HEAD`). A refused `Location` is named by its scheme, host, port and path
alone, never echoed when it does not parse (HF-8).

**Proxies.** `HTTP_PROXY` is ignored under CGI (`proxy variables: HTTP_PROXY
is ignored under CGI (httpoxy)`); https never falls back to the http proxy
(`httpProxyFor: https never falls back to the http proxy`); `NO_PROXY`
matches a name and the names under it, never a name that only ends the same
way, an address only exactly (`NO_PROXY: but not a name that only ends the
same way`, `NO_PROXY: an IPv4 address matches only itself, never as a
suffix`); a proxy that is not `http://` is `HTTP_E_PROXY`; an https fetch
goes through `CONNECT` with the proxy's credentials, and a refused `CONNECT`
is `HTTP_E_PROXY_REFUSED` (`a proxy that is not http:// is HTTP_E_PROXY`, `an
https fetch through a proxy is tunnelled with CONNECT, the proxy authorised`,
`a CONNECT the proxy answers with 407 is HTTP_E_PROXY_REFUSED`). Through an
http proxy, a caller's `Proxy-Authorization` is sent in place of the one made
from the proxy URL's userinfo (`a caller's Proxy-Authorization goes to the
proxy in place of the userinfo's`); a proxy setting an error names is its
scheme, host, port and path alone, and one that does not parse or has no host
is not echoed (HF-8).

**https.** The checks are in `tests/link/net_http_fetch_tls/main.ts`, run as
`link/net_http_fetch_tls: exits with 0 and stdout matches expected.out`. Its
servers are loopback TLS 1.3 servers over certificates made for the test and
frozen in `certs.ts`; the client trusts only the test's root through
`rootsPemPath`. A server the roots trust answers, and its connection is kept
(`an https fetch from a server the roots trust answers`, `and the next fetch
reuses the TLS connection`); an IP literal is matched against the
certificate's IP name (`an IP literal is matched against the certificate's IP
name, on its own connection`). A client reads its roots once: a root file
changed under it does not change what its next connection trusts (`a client
reads its roots once, not again for each connection`). `httpFetch` ends its
connection with a `close_notify` once its body is read (HF-4; `and once its
body is read, it ends the connection with a close_notify`). Every certificate the roots do not vouch for,
for this host, now, is `HTTP_E_CERTIFICATE` (`an expired certificate is
HTTP_E_CERTIFICATE`, `a certificate for another name is HTTP_E_CERTIFICATE`,
`a chain to a root the client does not trust is HTTP_E_CERTIFICATE`, `and so
is a good server under roots that are not its own`, `the system roots do not
trust the test's root`). With no root to trust the fetch is refused before a
connection opens (`with no root certificate to trust, https is
HTTP_E_CERTIFICATE`, `and no connection was opened for it`). A server that
does not speak TLS is `HTTP_E_TLS` (`a server that does not speak TLS is
HTTP_E_TLS`), and a body the path cuts off without a `close_notify` is an
error, never a short body (`a body cut off without a close_notify is
HTTP_E_TLS, not a short body`), while a body with no length ends cleanly at
the server's `close_notify` (`a body with no length ends at the server's
close_notify`, `and read again, it answers 0 with no error`). A pooled TLS
connection the server dropped, ended with a fatal alert, or ended with a
`close_notify` while idle, is retried on a new one (`a pooled TLS connection
the server dropped is retried on a new one`, `a pooled TLS connection the
server ends with an alert is retried on a new one`, `a pooled TLS connection
the server ended with a close_notify is retried on a new one`). A fresh
connection the server ends with an alert is `HTTP_E_TLS`, and the error names
the alert (`a fresh TLS connection the server ends with an alert is
HTTP_E_TLS`, `and the error names the alert the server sent`), and a server silent through the handshake is a read timeout, not a TLS
failure (`a server that never answers the handshake is HTTP_E_READ_TIMEOUT`).
A redirect from https to http is refused even
when cross-origin hops are allowed (`a redirect from https to http is refused
even with crossOriginRedirects`), and https through a proxy is a `CONNECT`
tunnel with TLS to the origin inside it (`https through an http proxy is a
CONNECT tunnel, then TLS to the origin`). The origin inside the tunnel is sent
no `Proxy-Authorization`, the caller's included, while the `CONNECT` carries
the proxy URL's (`through a tunnel the origin is sent no Proxy-Authorization,
not even the caller's`, `and the CONNECT carries the proxy URL's user and
password`). Bytes the proxy sends in the segment of its `200` belong to the
tunnel, so an alert there ends the handshake at once (`an alert the proxy sends
in the same segment as its 200 is read by TLS, not lost`).

**What no check reaches.** A failure of the poll loop itself (`pollCreate` or
`pollAdd` failing), a write that fails with an errno other than a reset, the
wiping of a closed connection's TLS keys (`drop` calls `wipe`; nothing a test
can read sees the keys), the freshness of the handshake's random values, and
a TLS record buffer that fills with no room for a read, which the record
layer's sizes keep from happening.

**Mutation sweep.** Hand-placed mutants of `std/net/http-client.ts`, each run
against `link/net_http_fetch`, `link/net_http_fetch_f64` and
`link/net_http_fetch_tls`, show which lines the checks above pin. Every
mutant of the retry rule (a dropped `reused`, `lost` or `gotByte` term, POST
made idempotent), of HF-7's `leftover` and `quiet` taken out together, of
HF-8's redaction at each of its seven call sites and in each of its cuts, of
`fill`'s `overdue`, of `maxHeaderBytes`, of the empty read, and of the TLS
read of bytes that arrive with a proxy's `200` (T9) is killed. A response the
server closes part way through counts as a lost connection, as one closed
before any byte does, so the dropped `gotByte` term is killed on every run by
`a GET whose answer was cut off part way is not sent again`, which needs no
timing. The reset check behind it waits until `/proc/net/tcp` shows the
client has read the bytes before it resets, and when it fails it says on
stderr how the server closed and what the client saw. These survive, and
stay:

- `L1`, `L2`, `L12`: HF-7 is closed twice, by `release` dropping a connection
  that holds a byte and by `open` reusing one only when `quiet`. Either alone
  keeps the next response clean, so taking one out is caught by the other;
  both are kept, since `quiet` is also what sees bytes the server sends while
  the connection sits idle, and `release` frees the socket at once.
- `O2`: `writeRaw`'s `overdue`. A write that never waits ends in a moment,
  and one that waits is cut by `wait` at the same deadline, so no loopback
  peer makes the two differ.
- `T10`: the handshake loop's wait for its last flight to leave. The request
  is written behind it in order, so a missing flush is made up by the next.
- `T15`: `conn.abort` on a read error. `drop` wipes and discards the
  connection anyway.
- `T19`: `writeTls`'s final flush. The read that follows flushes first.
- `T16`: `receiveTls`'s `want <= 0` guard, for a TLS connection with no
  room for the server's next record. The record layer opens each record it
  holds before the next read, so its buffer always has room and no peer
  reaches the guard; it stays as the stop for a buffer a later change
  shrinks, where reading 0 bytes would look like a close.
- `T18`: the branch for a failed write in the TLS write path. A peer that is
  gone fails the read that precedes the next write first, so the write's own
  errno is not reached on loopback; a write errno is recorded under "What no
  check reaches".
- `T20`: `drop`'s `conn.wipe` when a TLS connection closes. It clears keys in the
  client's own memory, which no peer can observe; key hygiene, kept.
- `T23`: the client random filled from the system's random source. An
  all-zero random still completes a handshake with a loopback server, since
  nothing checks it there; RFC 8446 §4.1.2 requires it to be fresh, and it
  is kept.
