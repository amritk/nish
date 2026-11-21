# Static files

`nish/net/static` serves the files under one directory: a stylesheet, a
script, the images and fonts a page loads. You give it the rest of the path a
`*` route matched, and it answers the request through the same server that
answers your API: [`nish/net/http-server`](http-server.md) on HTTP/1.1,
HTTP/2 and HTTP/3, or `nish/net/handler` on HTTP/1.1. It is imported like any
other library module ([`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import)),
and is native only.

It sends each file with its content type, an ETag and a Last-Modified, so a
browser asks again with `If-None-Match` and gets a 304; it answers a single
byte range with 206; it sends a precompressed `name.br` or `name.gz` when the
request's `Accept-Encoding` asks for one; and it refuses any path that would
leave the directory.

## A first file server

The example builds with
[`--allow-panics`](cli.md#asking-what-a-program-can-do): `nish/net/router`,
`nish/net/http-server` and `nish/net/static` keep panic sites no proof
removes yet, so a call to them is refused by default until the standard
library is made panic-free.

<!-- allow-panics: calls `std/net/http-server.ts`, `std/net/router.ts`, `std/net/static.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { HttpServer, HttpServerLimits } from "nish/net/http-server";
import { Http1Config } from "nish/net/http1-server";
import { Router, RouterLimits } from "nish/net/router";
import { STATIC_NOT_FOUND, StaticFiles, StaticLimits } from "nish/net/static";
import { tcpListen } from "nish:net";

// The routes, in the order they are added: `add` answers 0, 1.
const FILES: i32 = 0;
const FILES_HEAD: i32 = 1;

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/static/*");
  router.add("HEAD", "/static/*");
  const files = new StaticFiles("./public", new StaticLimits());
  if (files.root === "") {
    console.error("./public does not exist");
    return 1;
  }
  const listener: i32 = tcpListen("127.0.0.1", 8080, 1024);
  if (listener < 0) {
    console.error(`cannot listen: ${listener}`);
    return 1;
  }
  const server = new HttpServer(new HttpServerLimits(), router);
  server.listenHttp1(listener, new Http1Config(), 256);
  while (true) {
    server.wait(1000);
    while (server.ready()) {
      const r = server.take();
      switch (r.route) {
        case FILES:
        case FILES_HEAD:
          // A path it refuses, or a file that is not there: nothing was sent.
          if (files.serve(server, r, r.paramStart(0), r.paramEnd(0)) === STATIC_NOT_FOUND) {
            server.refuse(r);
          }
          break;
        default:
          server.refuse(r); // 404, or 405 with its Allow
      }
    }
  }
};
```

With `public/site.css` on disk, `curl -i localhost:8080/static/site.css`
answers it with `Content-Type: text/css; charset=utf-8`, its `ETag` and its
`Last-Modified`. `serve` answers `STATIC_NOT_FOUND` and sends nothing when
the file is missing or the path is refused; your program answers it, as it
answers any other path it has nothing for. `refused` tells the two apart,
for a log line.

`serveHandler` is the same call for a program on `nish/net/handler`:
`files.serveHandler(h, req, req.paramStart(0), req.paramEnd(0))`.

## Which paths are served

The span is percent-decoded once, strictly: `%00` and a malformed escape
refuse the path. It is then split on `/`, and the whole path is refused when
a segment:

- is empty, as in `a//b`;
- starts with a dot: `.`, `..`, and every dotfile such as `.env` or
  `.well-known`;
- holds a backslash or a control byte.

An encoded `/` (`%2f`) is a separator once decoded, so `sub%2f..` is refused
like `sub/..`. What is left is joined under the directory and resolved,
symbolic links followed, and a file whose real path is not under the
directory's own real path is refused, so a link that leads out is not
followed out. A path that is empty or ends in `/` serves that directory's
`index.html`; a directory, a FIFO or a device is never served.

A program that serves `/.well-known/` routes it itself, before the `*`
route.

## Types, validators and ranges

The content type comes from the extension. Among them:

| Extension | Content type |
| --- | --- |
| `.html` | `text/html; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.json` | `application/json` |
| `.svg` | `image/svg+xml` |
| `.webp` | `image/webp` |
| `.woff2` | `font/woff2` |

An extension the module does not know is sent as
`application/octet-stream`, and every file it sends says
`X-Content-Type-Options: nosniff`, so a browser does not guess another type.

The ETag is strong and made from the file's size and modification time.
`If-None-Match` with it, or `*`, answers 304 with no body; without
`If-None-Match`, an `If-Modified-Since` at or after the file's
`Last-Modified` answers 304 too.

One range, `Range: bytes=0-99`, `bytes=100-` or `bytes=-100`, answers 206
with its `Content-Range`. A range past the end is cut to the file; one that
starts past the end, is not a number, or ends before it starts answers 416
with `Content-Range: bytes */<size>`. Several ranges are answered 200 with
the whole file. `If-Range` keeps the range only while the file still has
that ETag or that `Last-Modified`.

A method other than `GET` or `HEAD` answers 405 with `Allow: GET, HEAD`.

## Precompressed files

Compress a file ahead of time and put it beside the original, `app.js.br`
and `app.js.gz` next to `app.js`. A request whose `Accept-Encoding` offers
`br` or `gzip` is sent the sibling, with `Content-Encoding`, the content type
of `app.js` and an ETag of its own; one that offers neither is sent `app.js`.
The codings are weighed by their q-values (`gzip;q=0.8, br;q=0.5` sends
gzip), a tie goes to `br`, and `q=0` refuses a coding. A range on a
compressed file counts the compressed bytes. Every file it sends, and
every 304, says `Vary: Accept-Encoding`, so a cache keeps each variant apart.

The module does not compress anything itself. Set `precompressed` to `false`
in its `StaticLimits` to send only the files as they are.

## The cache

Files of at most `maxCachedBytes` are kept in memory, at most `maxEntries`
of them, the oldest replaced first. Every request looks at the file on disk
again, and a file whose size or modification time changed is read again
before it is sent, under a new ETag; a removed file is a 404. A larger file
is read from disk for each request. You can deploy by replacing files under
a running server.

| `StaticLimits` | Default | Range |
| --- | --- | --- |
| `maxEntries` | 32 | 1 to 4096 |
| `maxCachedBytes` | 262144 | 0 to 2^30 |
| `maxPath` | 1024 | 1 to 4096 |
| `precompressed` | `true` | |
| `index` | `true` | |

A limit out of its range, or a root that does not exist, leaves `root`
empty, and every request is then a 404. A file of 2 GiB or more is a 404.

## Under the sandbox

`nish/net/static` reads the files it serves, so a program built with
[`--sandbox`](sandbox.md) grants it `fs.read` for the directory:

```sh
nish --link server.ts --sandbox --allow net,clock,fs.read=./public -o server
```

On a kernel with Landlock, the program then cannot read outside `./public`,
whatever path it is asked for.

The module's security record is
[docs/security/static.md](../../security/static.md); the reference is
[nish/net/static](../../reference/net/static.md).
