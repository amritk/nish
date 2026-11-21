// The Rust twin of bench/postgres/main.ts and twin.c: the same loop through
// tokio-postgres, the client most Rust programs reach PostgreSQL through
// (directly, or under deadpool-postgres or the sync `postgres` crate).
//
//   twin-rs <pk|list|insert> <port> <user> <password> <database> <count>
//
// It prints the line main.ts and twin.c print for the same arguments:
// `rows R checksum S failed F count N ns T user U sys K`, T the timed loop's
// wall time in nanoseconds, U and K the process's user and system CPU time
// over it (getrusage), in microseconds.
//
// One connection, on a current-thread runtime, so the client is one thread as
// the other two are. tokio-postgres pipelines the queries a task has in
// flight on its own: `futures` `buffered(depth)` keeps `depth` of them
// (16; 1 for insert), each `Client::query` (or `execute` for insert) on a
// statement prepared once with int8 parameters, which tokio-postgres sends as
// Bind, Execute, Sync, as main.ts does. It asks for every result column in
// binary, so the fold reads each column's raw bytes and folds what twin.c
// folds from the text: text columns are the same bytes in both formats; an
// integer, a bool and a timestamp are decoded from binary to the value whose
// text twin.c folds, the timestamp written as the same 24 ISO 8601 bytes;
// and the tag array's binary elements are walked as twin.c walks the text
// one. Every run checks the rows and checksum against the other sides.
//
// PK_SQL, LIST_SQL and INSERT_SQL are the queries of the challenge's SPEC.md
// (https://github.com/arjaythedev/multicore-server-challenge).
// Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
// see bench/postgres/LICENSE.md.
use futures_util::{StreamExt, stream};
use std::error::Error;
use std::process::exit;
use std::time::Instant;
use tokio_postgres::types::{FromSql, Type};
use tokio_postgres::{Client, NoTls, Row, Statement};

const PK_SQL: &str = "SELECT id, username, email, bio, image FROM users WHERE id = $1";
const LIST_SQL: &str = concat!(
    "SELECT a.id, a.slug, a.title, a.description, a.created_at, a.updated_at, ",
    "ARRAY(SELECT t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id ",
    "WHERE at.article_id = a.id ORDER BY t.name) AS tag_list, ",
    "(SELECT count(*) FROM favorites f WHERE f.article_id = a.id) AS favorites_count, ",
    "EXISTS (SELECT 1 FROM favorites f WHERE f.article_id = a.id AND f.user_id = $1) AS favorited, ",
    "u.username, u.bio, u.image, ",
    "EXISTS (SELECT 1 FROM follows fo WHERE fo.follower_id = $1 AND fo.followee_id = a.author_id) AS following ",
    "FROM articles a JOIN users u ON u.id = a.author_id ",
    "ORDER BY a.id DESC LIMIT $2 OFFSET $3"
);
const INSERT_SQL: &str = "INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING";
const RESET_SQL: &str = "DELETE FROM follows WHERE follower_id = followee_id";
const USERS: i64 = 100000;
const NULL_FOLD: u32 = 0xFFFF_FFFF;
// 2000-01-01, PostgreSQL's epoch, in days from 1970-01-01.
const PG_EPOCH_DAYS: i64 = 10957;

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Pk,
    List,
    Insert,
}

/// A column's bytes as the server sent them, whatever its type.
struct Raw<'a>(&'a [u8]);

impl<'a> FromSql<'a> for Raw<'a> {
    fn from_sql(_: &Type, raw: &'a [u8]) -> Result<Self, Box<dyn Error + Sync + Send>> {
        Ok(Raw(raw))
    }
    fn accepts(_: &Type) -> bool {
        true
    }
}

/// The checksum and counts every side prints.
struct Fold {
    sum: u32,
    rows: i64,
    failed: i32,
}

impl Fold {
    fn add(&mut self, v: u32) {
        self.sum = self.sum.wrapping_mul(31).wrapping_add(v);
    }

    fn bytes(&mut self, b: &[u8]) {
        let mut s = self.sum.wrapping_mul(31).wrapping_add(b.len() as u32);
        for &c in b {
            s = s.wrapping_mul(31).wrapping_add(c as u32);
        }
        self.sum = s;
    }

    fn raw<'r>(&mut self, row: &'r Row, c: usize) -> Option<&'r [u8]> {
        match row.try_get::<_, Option<Raw>>(c) {
            Ok(v) => v.map(|r| r.0),
            Err(_) => {
                self.failed += 1;
                None
            }
        }
    }

    fn text(&mut self, row: &Row, c: usize) {
        match self.raw(row, c) {
            Some(b) => self.bytes(b),
            None => self.add(NULL_FOLD),
        }
    }

    /// An int2, int4 or int8, as twin.c's strtoll of its text.
    fn integer(&mut self, row: &Row, c: usize) {
        let v = match self.raw(row, c) {
            Some(&[a, b]) => i16::from_be_bytes([a, b]) as i64,
            Some(&[a, b, c, d]) => i32::from_be_bytes([a, b, c, d]) as i64,
            Some(b) if b.len() == 8 => i64::from_be_bytes(b.try_into().unwrap()),
            _ => 0,
        };
        self.add(v as u32);
    }

    fn boolean(&mut self, row: &Row, c: usize) {
        let v = matches!(self.raw(row, c), Some(&[1]));
        self.add(v as u32);
    }

    /// A timestamp's microseconds from 2000-01-01 as twin.c writes its text:
    /// `YYYY-MM-DDTHH:MM:SS.mmmZ`, the fraction truncated to milliseconds;
    /// NULL_FOLD and a failure for a NULL, an infinity or a year outside 1 to 9999.
    fn timestamp(&mut self, row: &Row, c: usize) {
        let us = match self.raw(row, c) {
            Some(b) if b.len() == 8 => i64::from_be_bytes(b.try_into().unwrap()),
            _ => i64::MIN,
        };
        let days = us.div_euclid(86_400_000_000) + PG_EPOCH_DAYS;
        let rem = us.rem_euclid(86_400_000_000);
        let (y, m, d) = civil(days);
        if us == i64::MIN || us == i64::MAX || !(1..=9999).contains(&y) {
            self.add(NULL_FOLD);
            self.failed += 1;
            return;
        }
        let secs = rem / 1_000_000;
        let millis = rem % 1_000_000 / 1000;
        let mut out = [0u8; 24];
        let mut put = |at: usize, v: i64, n: usize| {
            let mut v = v;
            for k in (0..n).rev() {
                out[at + k] = b'0' + (v % 10) as u8;
                v /= 10;
            }
        };
        put(0, y, 4);
        put(5, m, 2);
        put(8, d, 2);
        put(11, secs / 3600, 2);
        put(14, secs / 60 % 60, 2);
        put(17, secs % 60, 2);
        put(20, millis, 3);
        out[4] = b'-';
        out[7] = b'-';
        out[10] = b'T';
        out[13] = b':';
        out[16] = b':';
        out[19] = b'.';
        out[23] = b'Z';
        self.bytes(&out);
    }

    /// A one-dimensional text[] in binary: each element's bytes, a NULL as
    /// NULL_FOLD, then the count, as twin.c walks the text form.
    fn array(&mut self, row: &Row, c: usize) {
        let Some(b) = self.raw(row, c) else {
            self.failed += 1;
            self.add(0);
            return;
        };
        let word = |at: usize| b.get(at..at + 4).map(|w| i32::from_be_bytes(w.try_into().unwrap()));
        let mut count = 0u32;
        let (Some(ndim), Some(_), Some(_)) = (word(0), word(4), word(8)) else {
            self.failed += 1;
            self.add(0);
            return;
        };
        let mut p = 12;
        let mut n = 0;
        if ndim == 1 {
            n = word(12).unwrap_or(-1);
            p = 20;
        } else if ndim != 0 {
            n = -1;
        }
        if n < 0 {
            self.failed += 1;
            self.add(0);
            return;
        }
        for _ in 0..n {
            match word(p) {
                Some(-1) => {
                    p += 4;
                    self.add(NULL_FOLD);
                }
                Some(len) if len >= 0 && p + 4 + len as usize <= b.len() => {
                    self.bytes(&b[p + 4..p + 4 + len as usize]);
                    p += 4 + len as usize;
                }
                _ => {
                    self.failed += 1;
                    break;
                }
            }
            count += 1;
        }
        if p != b.len() {
            self.failed += 1;
        }
        self.add(count);
    }

    fn rows(&mut self, mode: Mode, rows: &[Row]) {
        for row in rows {
            self.integer(row, 0);
            if mode == Mode::Pk {
                for c in 1..5 {
                    self.text(row, c);
                }
            } else {
                self.text(row, 1);
                self.text(row, 2);
                self.text(row, 3);
                self.timestamp(row, 4);
                self.timestamp(row, 5);
                self.array(row, 6);
                self.integer(row, 7);
                self.boolean(row, 8);
                self.text(row, 9);
                self.text(row, 10);
                self.text(row, 11);
                self.boolean(row, 12);
            }
            self.rows += 1;
        }
    }
}

/// Days from 1970-01-01 to (year, month, day), proleptic Gregorian.
fn civil(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + (m <= 2) as i64, m, d)
}

/// twin.c's and main.ts's xorshift of the ids a run queries.
struct Ids(u32);

impl Ids {
    fn next(&mut self) -> i64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x as i64 % USERS) + 1
    }
}

/// The parameters of query `i` of `mode`.
fn params(mode: Mode, i: i32, ids: &mut Ids) -> [i64; 3] {
    match mode {
        Mode::Pk => [ids.next(), 0, 0],
        Mode::List => [ids.next(), 20, (i % 10 * 20) as i64],
        Mode::Insert => {
            let a = 1 + i as i64 % USERS;
            [a, a, 0]
        }
    }
}

/// Runs `n` queries of `mode`, up to `depth` in flight, folding their results when `folding`.
async fn run(client: &Client, st: &Statement, mode: Mode, n: i32, depth: usize, f: &mut Fold, folding: bool) {
    let mut ids = Ids(2463534242);
    let queries = (0..n).map(|i| {
        let p = params(mode, i, &mut ids);
        async move {
            let answer: Result<Result<Vec<Row>, u64>, tokio_postgres::Error> = match mode {
                Mode::Pk => client.query(st, &[&p[0]]).await.map(Ok),
                Mode::List => client.query(st, &[&p[0], &p[1], &p[2]]).await.map(Ok),
                Mode::Insert => client.execute(st, &[&p[0], &p[1]]).await.map(Err),
            };
            answer
        }
    });
    let mut answers = stream::iter(queries).buffered(depth);
    while let Some(answer) = answers.next().await {
        match answer {
            _ if !folding => {}
            Ok(Ok(rows)) => f.rows(mode, &rows),
            Ok(Err(k)) => {
                f.rows += k as i64;
                f.add(k as u32);
            }
            Err(e) => {
                eprintln!("twin-rs: query: {e}");
                f.failed += 1;
            }
        }
    }
}

fn cpu_micros() -> (i64, i64) {
    // SAFETY: getrusage writes the struct it is given and reads nothing else.
    let mut u: libc::rusage = unsafe { std::mem::zeroed() };
    unsafe { libc::getrusage(libc::RUSAGE_SELF, &mut u) };
    let us = |t: libc::timeval| t.tv_sec as i64 * 1_000_000 + t.tv_usec as i64;
    (us(u.ru_utime), us(u.ru_stime))
}

fn die(what: &str, e: tokio_postgres::Error) -> ! {
    eprintln!("twin-rs: {what}: {e}");
    exit(1)
}

async fn bench(args: &[String]) {
    let mode = match args[1].as_str() {
        "pk" => Mode::Pk,
        "list" => Mode::List,
        "insert" => Mode::Insert,
        m => {
            eprintln!("twin-rs: unknown mode {m}");
            exit(2)
        }
    };
    let count: i32 = args[6].parse().unwrap_or(0);
    let depth = if mode == Mode::Insert { 1 } else { 16 };
    // Plain TCP, as main.ts's and twin.c's; tokio-postgres sets TCP_NODELAY.
    let mut config = tokio_postgres::Config::new();
    config
        .host("127.0.0.1")
        .port(args[2].parse().unwrap_or(0))
        .user(&args[3])
        .password(&args[4])
        .dbname(&args[5])
        .ssl_mode(tokio_postgres::config::SslMode::Disable);
    let (client, connection) = config.connect(NoTls).await.unwrap_or_else(|e| die("connect", e));
    let conn = tokio::spawn(connection);
    let (sql, types): (&str, &[Type]) = match mode {
        Mode::Pk => (PK_SQL, &[Type::INT8]),
        Mode::List => (LIST_SQL, &[Type::INT8, Type::INT8, Type::INT8]),
        Mode::Insert => (INSERT_SQL, &[Type::INT8, Type::INT8]),
    };
    let st = client.prepare_typed(sql, types).await.unwrap_or_else(|e| die("prepare", e));
    let mut f = Fold { sum: 0, rows: 0, failed: 0 };
    run(&client, &st, mode, depth as i32, depth, &mut f, false).await;
    if mode == Mode::Insert {
        client.batch_execute(RESET_SQL).await.unwrap_or_else(|e| die("reset", e));
    }
    let (user0, sys0) = cpu_micros();
    let t0 = Instant::now();
    run(&client, &st, mode, count, depth, &mut f, true).await;
    let ns = t0.elapsed().as_nanos();
    let (user, sys) = cpu_micros();
    if mode == Mode::Insert {
        client.batch_execute(RESET_SQL).await.unwrap_or_else(|e| die("reset", e));
    }
    println!(
        "rows {} checksum {} failed {} count {count} ns {ns} user {} sys {}",
        f.rows,
        f.sum,
        f.failed,
        user - user0,
        sys - sys0
    );
    drop(client);
    let _ = conn.await;
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 7 {
        eprintln!("usage: twin-rs <pk|list|insert> <port> <user> <password> <database> <count>");
        exit(2);
    }
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap_or_else(|e| {
            eprintln!("twin-rs: runtime: {e}");
            exit(1)
        });
    rt.block_on(bench(&args));
}
