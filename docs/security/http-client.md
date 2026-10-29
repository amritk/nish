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
too, without the caller's credentials. `HTTP_PROXY` is ignored under CGI. Four
findings were fixed while the module was written (HF-1, HF-4, HF-5 and HF-6,
Low); two are open (HF-2 and HF-3, Low). https is TLS 1.3 through `TlsRecordClient`: the
server's chain is checked under the caller's roots, or the system's, at the
wall clock's time and for the URL's host before a byte of the request is
sent; no root to trust is a refusal before any connection; there is no switch
that turns the check off; and a body is whole only once the server's
`close_notify` or its framing says so. Revocation is not checked
([PKI-17](crypto-pki.md#pki-17-medium-revocation-is-not-checked)).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-client.ts` | `httpFetch`, `httpErrorName`, `httpChooseProxy`, `httpProxyFor`, `httpNoProxyMatch`; `HttpRequest` (`header`), `HttpOptions`, `HttpResponse` (`header`), `HttpBodyReader` (`read`, `readAll`); `HttpClient` (`setProxies`, `fetch`, `close`, `exchange`, `open`, `tunnel`, `send`, `head`, `pump`, `fill`, `writeAll`, `dial`, `wait`, `unwatch`, `readDeadline`, `drop`, `drain`, `readBody`, `refuseBody`, `failWait`, `fail`, `loadTrust`, `secure`, `receiveTls`, `flushTls`, `failTls`, `readRaw`, `writeRaw`); and the helpers (`httpClientParser`, `httpClientIsRedirect`, `httpClientIdempotent`, `httpClientDropField`, `httpClientLower`, `httpClientTrim`, `httpClientTrimDots`, `httpClientPort`, `httpClientIsIpLiteral`, `httpClientHostText`, `httpClientUrlText`, `httpClientProxyUrl`, `httpClientProxyAuth`) |

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
| HF-3 | Low | `std/net/http-client.ts` (`HttpClient.fetch`, `send`, `dial`) | Each fetch makes its field arrays, its response, the response's copies of the parser's fields, the lookup's address arrays and its error text afresh, so they stay in the arena until the program resets it, as HC-1 records for the parser beneath. Bounded for each fetch by `maxRedirects + 1` heads of `HTTP_CLIENT_MAX_HEADERS` fields within the parser's caps. | **Open, accepted for now.** A long-running program fetches inside an arena it resets; a per-connection arena closes it with HC-1. |

## Fuzzing

Not fuzzed. The module parses no wire bytes of its own: the response goes
through `Http1ResponseParser`, which `tests/fuzz/targets/http1-client.ts`
fuzzes, and the URL and `Location` through `urlParse` and `urlResolve`, which
`url.md` covers. What it parses itself is trusted configuration: the proxy
variables and `NO_PROXY`, pinned by the checks below.

## Properties verified

Each property below is pinned by a check that fails if it stops holding. The
checks are in `tests/link/net_http_fetch/main.ts`, run as
`link/net_http_fetch: exits with 0 and stdout matches expected.out` (the
template `link/${name}: exits with ${wantCode} and stdout matches
expected.out` in `tests/run.js`); each check's own line is in `expected.out`.
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

**Every wait ends.** A server that never answers is `HTTP_E_READ_TIMEOUT`
after `readTimeoutMs` (`a server that never answers is HTTP_E_READ_TIMEOUT`,
`after readTimeoutMs`); a body dripped a byte at a time, each byte inside the
read timeout, is cut off by `totalTimeoutMs`, counted from the start of the
fetch (`a body dripped a byte at a time is cut off by totalTimeoutMs`, `after
totalTimeoutMs, counted from the start of the fetch`, `and the error says the
fetch ran past totalTimeoutMs`); a listener that never
accepts is `HTTP_E_CONNECT_TIMEOUT` (`a listener whose backlog is full is
HTTP_E_CONNECT_TIMEOUT`). A refused port and an unknown name have their own
codes (`a port nothing listens on is HTTP_E_REFUSED`, `a name that does not
exist is HTTP_E_DNS`).

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
whole`). A stream is handed out as it arrives (`an event stream's first event is read
while the server holds the stream open`).

**Keep-alive cannot mix responses.** A second fetch reuses the connection
only once the first body is read (`the second fetch reused the first one's
connection`); a fetch while a body is unread closes the connection, and the
old reader answers an error rather than the next response's bytes (`a body
left unread answers an error once the next fetch starts`, `and the next fetch
went on a new connection`); a body read to its end answers 0 again (HF-1). A
stale reader leaves the later fetch's error alone, and a body its client
closed early answers an error (HF-6). A
kept connection the server closed is retried once for a GET and never for a
POST (`a GET on it is sent again on a fresh connection`, `a POST on it is not
sent twice: it fails with HTTP_E_IO`). A response that says `Connection:
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
body`, `and so does 308, its relative Location resolved`), and a HEAD stays a
HEAD through a 303 (`a HEAD redirected by 303 stays a HEAD`).

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
`a CONNECT the proxy answers with 407 is HTTP_E_PROXY_REFUSED`).

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
CONNECT tunnel, then TLS to the origin`).

**What no check reaches.** A failure of the poll loop itself (`pollCreate` or
`pollAdd` failing), a write that fails with an errno other than a reset, the
wiping of a closed connection's TLS keys (`drop` calls `wipe`; nothing a test
can read sees the keys), the freshness of the handshake's random values, and
a TLS record buffer that fills with no room for a read, which the record
layer's sizes keep from happening.
