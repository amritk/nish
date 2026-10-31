// nish/net/postgres's connection targets: which socket or TCP host a libpq
// `host` and `port`, or a `postgres://` URL, name, and every input refused.
// Nothing here reads the environment, so each answer is the same anywhere.
import {
  PgTarget,
  pgTarget,
  pgTargetUrl,
  PG_TARGET_BAD_ESCAPE,
  PG_TARGET_BAD_HOST,
  PG_TARGET_BAD_PORT,
  PG_TARGET_BAD_URL,
  PG_TARGET_OK,
  PG_TARGET_TOO_LONG,
} from "nish/net/postgres";
import { Suite } from "nish/testing";

/** A target as one line: failure, unix or tcp, host, port, path. */
const show = (target: PgTarget): string => {
  const kind: string = target.unix ? "unix" : "tcp";
  return `${target.failure} ${kind} ${target.host} ${target.port} ${target.path}`;
};

/** `fill` repeated `count` times after `start`. */
const padded = (start: string, fill: string, count: i32): string => {
  let out: string = start;
  for (let i: i32 = 0; i < count; i++) {
    out = `${out}${fill}`;
  }
  return out;
};

const hosts = (t: Suite): void => {
  t.eqStr("a directory is its .s.PGSQL socket", show(pgTarget("/run/postgresql", 5432)), "0 unix /run/postgresql 5432 /run/postgresql/.s.PGSQL.5432");
  t.eqStr("the port names the socket", show(pgTarget("/tmp", 6543)), "0 unix /tmp 6543 /tmp/.s.PGSQL.6543");
  t.eqStr(
    "a full socket path is taken as a directory, as libpq does",
    show(pgTarget("/tmp/.s.PGSQL.5432", 5432)),
    "0 unix /tmp/.s.PGSQL.5432 5432 /tmp/.s.PGSQL.5432/.s.PGSQL.5432",
  );
  t.eqStr("an @ host is an abstract socket", show(pgTarget("@pg", 5432)), "0 unix @pg 5432 @pg/.s.PGSQL.5432");
  t.eqStr("a name is TCP, unchanged", show(pgTarget("db.example.com", 5432)), "0 tcp db.example.com 5432 ");
  t.eqStr("an address is TCP, unchanged", show(pgTarget("127.0.0.1", 15432)), "0 tcp 127.0.0.1 15432 ");
  t.eqStr("a relative path is TCP, as in libpq", show(pgTarget("tmp/pg", 5432)), "0 tcp tmp/pg 5432 ");
  t.eqI32("an empty host is refused", pgTarget("", 5432).failure, PG_TARGET_BAD_HOST);
  t.eqI32("two hosts are refused", pgTarget("/tmp,/run", 5432).failure, PG_TARGET_BAD_HOST);
  t.eqI32("a NUL in the host is refused", pgTarget(`/tmp${String.fromCharCode(0)}x`, 5432).failure, PG_TARGET_BAD_HOST);
  t.eqI32("port 0 is refused", pgTarget("/tmp", 0).failure, PG_TARGET_BAD_PORT);
  t.eqI32("port 65536 is refused", pgTarget("/tmp", 65536).failure, PG_TARGET_BAD_PORT);
  t.eqI32("port 65535 is taken", pgTarget("/tmp", 65535).failure, PG_TARGET_OK);
  t.ok("a refused target is not unix", !pgTarget("", 5432).unix);
};

const lengths = (t: Suite): void => {
  // `/.s.PGSQL.5432` is 14 bytes: a 93-byte directory makes a 107-byte path.
  const fits: PgTarget = pgTarget(padded("/", "d", 92), 5432);
  t.eqI32("a 107-byte socket path is taken", fits.failure, PG_TARGET_OK);
  t.eqI32("whole", fits.path.length, 107);
  const over: PgTarget = pgTarget(padded("/", "d", 93), 5432);
  t.eqI32("a 108-byte socket path is refused", over.failure, PG_TARGET_TOO_LONG);
  t.eqStr("not cut short", over.path, "");
  t.ok("nor unix", !over.unix);
  t.eqI32("an @ name of 107 bytes after the @ is taken", pgTarget(padded("@", "d", 93), 5432).failure, PG_TARGET_OK);
  t.eqI32("one of 108 is refused", pgTarget(padded("@", "d", 94), 5432).failure, PG_TARGET_TOO_LONG);
  t.eqI32("a longer port counts", pgTarget(padded("/", "d", 92), 15432).failure, PG_TARGET_TOO_LONG);
  // `é` is 2 bytes: 91 + 2 + 14 bytes is 107, one `d` more is 108.
  t.eqI32("multi-byte UTF-8 counts in bytes: 107 is taken", pgTarget(`${padded("/", "d", 90)}é`, 5432).failure, PG_TARGET_OK);
  t.eqI32("and 108 refused", pgTarget(`${padded("/", "d", 91)}é`, 5432).failure, PG_TARGET_TOO_LONG);
  t.eqStr("a trailing / is kept, as libpq does", show(pgTarget("/tmp/", 5432)), "0 unix /tmp/ 5432 /tmp//.s.PGSQL.5432");
  t.eqStr("pgTarget does not percent-decode", show(pgTarget("%2Ftmp", 5432)), "0 tcp %2Ftmp 5432 ");
  t.eqI32("a long TCP host is no socket path", pgTarget(padded("h", "h", 200), 5432).failure, PG_TARGET_OK);
};

const urls = (t: Suite): void => {
  t.eqStr("a TCP URL", show(pgTargetUrl("postgres://u:p@db.example.com:6000/app")), "0 tcp db.example.com 6000 ");
  t.eqStr("postgresql:// too", show(pgTargetUrl("postgresql://db/app")), "0 tcp db 5432 ");
  t.eqStr("no port is 5432", show(pgTargetUrl("postgres://u@%2Ftmp/app")), "0 unix /tmp 5432 /tmp/.s.PGSQL.5432");
  t.eqStr(
    "a percent-encoded directory",
    show(pgTargetUrl("postgres://u@%2Fvar%2Frun%2Fpostgresql:6543/app")),
    "0 unix /var/run/postgresql 6543 /var/run/postgresql/.s.PGSQL.6543",
  );
  t.eqStr("lower-case escapes", show(pgTargetUrl("postgres://%2ftmp")), "0 unix /tmp 5432 /tmp/.s.PGSQL.5432");
  t.eqStr("an encoded @ is an abstract name", show(pgTargetUrl("postgres://u@%40pg/app")), "0 unix @pg 5432 @pg/.s.PGSQL.5432");
  t.eqStr("?host= names the directory", show(pgTargetUrl("postgres:///app?host=/tmp")), "0 unix /tmp 5432 /tmp/.s.PGSQL.5432");
  t.eqStr(
    "?host= overrides the authority, ?port= the port",
    show(pgTargetUrl("postgres://u@db:1/app?sslmode=disable&host=%2Frun&port=7000")),
    "0 unix /run 7000 /run/.s.PGSQL.7000",
  );
  t.eqStr("an IPv6 host loses its brackets", show(pgTargetUrl("postgres://[::1]:5433/app")), "0 tcp ::1 5433 ");
  t.eqI32("a second @ is refused, not read as the host", pgTargetUrl("postgres://u:p@ss@db/app").failure, PG_TARGET_BAD_HOST);
  t.eqStr("an encoded @ in the password is the user's", show(pgTargetUrl("postgres://u:p%40ss@db/app")), "0 tcp db 5432 ");
  t.eqI32("an @ after a ? is refused", pgTargetUrl("postgres://db?x=a@evil/app").failure, PG_TARGET_BAD_HOST);
  t.eqStr("an @ in the path is the database's", show(pgTargetUrl("postgres://db/a@b")), "0 tcp db 5432 ");
  t.eqStr("a query with no path", show(pgTargetUrl("postgres://db?port=6000")), "0 tcp db 6000 ");
  t.eqI32("another scheme is refused", pgTargetUrl("mysql://db/app").failure, PG_TARGET_BAD_URL);
  t.eqI32("the scheme is case-sensitive", pgTargetUrl("POSTGRES://db/app").failure, PG_TARGET_BAD_URL);
  t.eqI32("a key with no = is refused", pgTargetUrl("postgres://db/app?host").failure, PG_TARGET_BAD_URL);
  t.eqI32("no host is refused", pgTargetUrl("postgres:///app").failure, PG_TARGET_BAD_HOST);
  t.eqI32("an unclosed [ is refused", pgTargetUrl("postgres://[::1/app").failure, PG_TARGET_BAD_HOST);
  t.eqI32("text after ] is refused", pgTargetUrl("postgres://[::1]x/app").failure, PG_TARGET_BAD_HOST);
  t.eqI32("an encoded , is two hosts", pgTargetUrl("postgres://%2Fa%2C%2Fb/app").failure, PG_TARGET_BAD_HOST);
  t.eqI32("an empty port is refused", pgTargetUrl("postgres://db:/app").failure, PG_TARGET_BAD_PORT);
  t.eqI32("a port of letters is refused", pgTargetUrl("postgres://db:http/app").failure, PG_TARGET_BAD_PORT);
  t.eqI32("a six-digit port is refused", pgTargetUrl("postgres://db:015432/app").failure, PG_TARGET_BAD_PORT);
  t.eqI32("?port=0 is refused", pgTargetUrl("postgres://db/app?port=0").failure, PG_TARGET_BAD_PORT);
  t.eqI32("URL port 65536 is refused", pgTargetUrl("postgres://db:65536/app").failure, PG_TARGET_BAD_PORT);
  t.eqI32("an empty ?port= is refused", pgTargetUrl("postgres://db/app?port=").failure, PG_TARGET_BAD_PORT);
  t.eqI32("an empty ?host= is refused", pgTargetUrl("postgres://db/app?host=").failure, PG_TARGET_BAD_HOST);
  t.eqStr("?host=@x is an abstract name", show(pgTargetUrl("postgres://db/app?host=@x")), "0 unix @x 5432 @x/.s.PGSQL.5432");
  t.eqStr("%252F stays the TCP host %2F", show(pgTargetUrl("postgres://%252Ftmp/app")), "0 tcp %2Ftmp 5432 ");
  t.eqStr("a bracketed host is decoded too, as libpq does", show(pgTargetUrl("postgres://[%2Ftmp]/app")), "0 unix /tmp 5432 /tmp/.s.PGSQL.5432");
  t.eqStr(
    "a URL's socket file is a directory too",
    show(pgTargetUrl("postgres://%2Ftmp%2F.s.PGSQL.5432/app")),
    "0 unix /tmp/.s.PGSQL.5432 5432 /tmp/.s.PGSQL.5432/.s.PGSQL.5432",
  );
  t.eqI32("a URL's @ name of 107 bytes after the @ is taken", pgTargetUrl(padded("postgres:///app?host=@", "d", 93)).failure, PG_TARGET_OK);
  t.eqI32("one of 108 is refused", pgTargetUrl(padded("postgres:///app?host=@", "d", 94)).failure, PG_TARGET_TOO_LONG);
  t.eqI32("a long encoded directory is refused", pgTargetUrl(padded("postgres://", "%2Fd", 47)).failure, PG_TARGET_TOO_LONG);
};

/** `url` with a raw NUL byte put in place of its `#`. */
const nul = (url: string): string => {
  const at: i32 = toI32(url.indexOf("#"));
  return `${url.substring(0, at)}${String.fromCharCode(0)}${url.substring(at + 1)}`;
};

const nuls = (t: Suite): void => {
  t.eqI32("a raw NUL in the user is refused", pgTargetUrl(nul("postgres://u#@db/app")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in the password", pgTargetUrl(nul("postgres://u:p#@db/app")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in the host", pgTargetUrl(nul("postgres://%2Ftmp#x/app")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in the port", pgTargetUrl(nul("postgres://db:54#32/app")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in the database", pgTargetUrl(nul("postgres://db/a#pp")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in a query key", pgTargetUrl(nul("postgres://db/app?ho#st=/tmp")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in a query value", pgTargetUrl(nul("postgres://db/app?host=/tmp#x")).failure, PG_TARGET_BAD_HOST);
  t.eqI32("in an ignored value", pgTargetUrl(nul("postgres://db/app?sslmode=dis#able")).failure, PG_TARGET_BAD_HOST);
};

const escapes = (t: Suite): void => {
  t.eqI32("a bare % ends the host", pgTargetUrl("postgres://%/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("a % with one digit", pgTargetUrl("postgres://%2/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("%G1 is no hex", pgTargetUrl("postgres://%G1/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("%1G is no hex", pgTargetUrl("postgres://%1G/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("%00 is refused", pgTargetUrl("postgres://%2Ftmp%00x/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("in the user too", pgTargetUrl("postgres://u%G1@db/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("in the database too", pgTargetUrl("postgres://db/a%00").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("in the port", pgTargetUrl("postgres://db:%3/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("in a query key", pgTargetUrl("postgres://db/app?h%=x").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("in a query value", pgTargetUrl("postgres://db/app?host=%2").failure, PG_TARGET_BAD_ESCAPE);
  t.eqI32("in an ignored value", pgTargetUrl("postgres://db/app?sslmode=%zz").failure, PG_TARGET_BAD_ESCAPE);
  t.eqStr("an encoded port", show(pgTargetUrl("postgres://db:%36000/app")), "0 tcp db 6000 ");
  t.eqI32("an escape that is not UTF-8 is refused", pgTargetUrl("postgres://%2Ftmp%FF/app").failure, PG_TARGET_BAD_ESCAPE);
  t.eqStr("escaped UTF-8 decodes", show(pgTargetUrl("postgres://%2Ftmp%C3%A9/app")), "0 unix /tmpé 5432 /tmpé/.s.PGSQL.5432");
};

/**
 * 3000 URLs drawn from a fixed seed (xorshift32) from the bytes and escapes
 * the parser splits on, escapes cut anywhere included: none panics, each answers a
 * defined failure, and a socket target is a directory path of at most 107 bytes
 * or an `@` name of at most 108.
 */
const fuzz = (t: Suite): void => {
  const pieces: string[] = [
    "/", "@", ":", "%", "?", "&", "=", "[", "]", ",", ".", "0", "5", "9", "a", "F", "G",
    "%2F", "%2f", "%40", "%00", "%3A", "?host=", "?host=%2F", "&port=", "postgres://", "dddddddddddddddd",
  ];
  let seed: i32 = 463534242;
  let defined: boolean = true;
  let fits: boolean = true;
  let sockets: i32 = 0;
  for (let k: i32 = 0; k < 3000; k++) {
    let url: string = k % 2 === 0 ? "postgres://" : "postgresql://";
    seed = seed ^ (seed << 13);
    seed = seed ^ (seed >>> 17);
    seed = seed ^ (seed << 5);
    const n: i32 = (seed >>> 1) % 40;
    for (let i: i32 = 0; i < n; i++) {
      seed = seed ^ (seed << 13);
      seed = seed ^ (seed >>> 17);
      seed = seed ^ (seed << 5);
      const at: i32 = (seed >>> 1) % toI32(pieces.length);
      url = `${url}${pieces[at]}`;
    }
    const target: PgTarget = pgTargetUrl(url);
    if (target.failure < PG_TARGET_OK || target.failure > PG_TARGET_TOO_LONG) {
      defined = false;
    }
    if (target.unix) {
      sockets += 1;
      const limit: i32 = target.host.startsWith("@") ? 108 : 107;
      if (target.failure !== PG_TARGET_OK || toI32(target.path.length) > limit || !target.path.endsWith(`/.s.PGSQL.${target.port}`)) {
        fits = false;
      }
    }
  }
  t.ok("3000 seeded URLs: each answers a defined failure", defined);
  t.ok("and each socket target fits sun_path", fits);
  t.ok("some of them sockets", sockets > 0);
};

export const main = (): number => {
  const t = new Suite("postgres targets");
  hosts(t);
  lengths(t);
  urls(t);
  nuls(t);
  escapes(t);
  fuzz(t);
  return t.done();
};
