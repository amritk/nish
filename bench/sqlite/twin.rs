// The Rust twin of bench/sqlite/main.ts and twin.c: the same loop through
// rusqlite, the Rust crate most Rust programs reach SQLite through.
//
//   twin-rs <lookup|feed|insert|insert-txn> <db> <count>
//   twin-rs options <db>     SQLite's compile options, one a line
//
// `bench/sqlite/run.mjs` builds it with cargo against the vendored
// runtime/sqlite/sqlite3.c, compiled with the C twin's flags but
// SQLITE_THREADSAFE=2: rusqlite refuses to open a connection on a SQLite built
// THREADSAFE=0. run.mjs compares `options` with the C twin's on that build, so
// both run the same SQLite.
//
// A workload prints `rows R checksum S failed F count N ns T`, the line
// twin.c prints for the same arguments; T is the timed loop alone. Each call
// is what twin.c does, written the way rusqlite is written: `query_row` (bind,
// step, the closure, reset when the rows drop) for a lookup and an insert,
// `query` and `Rows::next` for the feed, on a statement prepared once. Text is
// read as `get_ref(c)?.as_bytes()`, which neither allocates nor checks UTF-8,
// and copied into one reused buffer, as twin.c's memcpy and main.ts's
// `columnInto` copy it.
//
// USERS and POSTS are the sizes of the twelve-dollar server challenge's
// seed/generate.mjs (https://github.com/arjaythedev/twelve-dollar-server-challenge);
// POST_SQL and INSERT_SQL are the queries of its SPEC.md.
// Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
// see bench/sqlite/LICENSE.md.
use rusqlite::{Connection, OpenFlags, Row, Statement};
use std::process::exit;
use std::time::Instant;

const USERS: i64 = 50000;
const POSTS: u32 = 500000;
const POST_SQL: &str = "SELECT p.id, p.body, p.created_at, u.username, (SELECT count(*) FROM likes l WHERE l.post_id = p.id) FROM posts p JOIN users u ON u.id = p.user_id";
const INSERT_SQL: &str = "INSERT INTO posts (user_id, body) VALUES (?, ?) RETURNING id, created_at";

/// The checksum every value read is folded into, and the buffer text is copied into.
struct Fold {
    sum: u32,
    buf: [u8; 1024],
}

impl Fold {
    fn add(&mut self, v: u32) {
        self.sum = self.sum.wrapping_mul(31).wrapping_add(v);
    }

    /// Column `c` copied into `buf`, its length and every byte folded.
    fn text(&mut self, row: &Row<'_>, c: usize) -> rusqlite::Result<()> {
        let bytes = row.get_ref(c)?.as_bytes()?;
        let n = bytes.len();
        if n <= self.buf.len() {
            self.buf[..n].copy_from_slice(bytes);
        }
        let mut sum = self.sum.wrapping_mul(31).wrapping_add(n as u32);
        for &b in &self.buf[..n.min(self.buf.len())] {
            sum = sum.wrapping_mul(31).wrapping_add(b as u32);
        }
        self.sum = sum;
        Ok(())
    }

    /// One row of POST_SQL: id, body, created_at, username, like count.
    fn post(&mut self, row: &Row<'_>) -> rusqlite::Result<()> {
        self.add(row.get::<_, i64>(0)? as u32);
        self.text(row, 1)?;
        self.text(row, 2)?;
        self.text(row, 3)?;
        self.add(row.get::<_, i64>(4)? as u32);
        Ok(())
    }
}

fn die(what: &str, e: rusqlite::Error) -> ! {
    eprintln!("twin-rs: {what}: {e}");
    exit(2)
}

fn prepare<'c>(db: &'c Connection, sql: &str) -> Statement<'c> {
    db.prepare(sql).unwrap_or_else(|e| die(sql, e))
}

fn exec(db: &Connection, sql: &str) {
    db.execute_batch(sql).unwrap_or_else(|e| die(sql, e))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() == 3 && args[1] == "options" {
        let db = Connection::open_with_flags(&args[2], OpenFlags::SQLITE_OPEN_READ_ONLY)
            .unwrap_or_else(|e| die(&args[2], e));
        let mut st = prepare(&db, "PRAGMA compile_options");
        let mut rows = st.query([]).unwrap_or_else(|e| die("compile_options", e));
        while let Some(row) = rows.next().unwrap_or_else(|e| die("compile_options", e)) {
            println!("{}", row.get::<_, String>(0).unwrap_or_else(|e| die("compile_options", e)));
        }
        return;
    }
    if args.len() != 4 {
        eprintln!("usage: twin-rs <lookup|feed|insert|insert-txn> <db> <count> | twin-rs options <db>");
        exit(2);
    }
    let mode = args[1].as_str();
    let count: i32 = args[3].parse().unwrap_or(0);
    let db = Connection::open_with_flags(
        &args[2],
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .unwrap_or_else(|e| die(&args[2], e));
    exec(&db, "PRAGMA synchronous=NORMAL");
    let mut f = Fold { sum: 0, buf: [0; 1024] };
    let mut rows: i32 = 0;
    let mut failed: i32 = 0;
    let t0: Instant;
    let t1: Instant;

    match mode {
        "lookup" => {
            let sql = format!("{POST_SQL} WHERE p.id = ?");
            let mut st = prepare(&db, &sql);
            let mut x: u32 = 2463534242;
            t0 = Instant::now();
            for _ in 0..count {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                let id = (x % POSTS) as i64 + 1;
                match st.query_row([id], |row| f.post(row)) {
                    Ok(()) => rows += 1,
                    Err(_) => failed += 1,
                }
            }
            t1 = Instant::now();
            if st.finalize().is_err() {
                failed += 1;
            }
        }
        "feed" => {
            let sql = format!("{POST_SQL} ORDER BY p.created_at DESC, p.id DESC LIMIT 20");
            let mut st = prepare(&db, &sql);
            t0 = Instant::now();
            for _ in 0..count {
                match st.query([]) {
                    Ok(mut rs) => loop {
                        match rs.next() {
                            Ok(Some(row)) => {
                                rows += 1;
                                if f.post(row).is_err() {
                                    failed += 1;
                                }
                            }
                            Ok(None) => break,
                            Err(_) => {
                                failed += 1;
                                break;
                            }
                        }
                    },
                    Err(_) => failed += 1,
                }
            }
            t1 = Instant::now();
            if st.finalize().is_err() {
                failed += 1;
            }
        }
        "insert" | "insert-txn" => {
            let txn = mode == "insert-txn";
            // The 64 bodies the inserts cycle through, built as twin.c and
            // main.ts build them; they are ASCII, so a `&str` of each binds as
            // text with no check at the bind.
            let bodies: Vec<String> = (0..64)
                .map(|k: i32| {
                    let len = 40 + (k * 37) % 200;
                    (0..len)
                        .map(|j| if j % 6 == 5 { ' ' } else { (b'a' + ((j * 7 + k) % 26) as u8) as char })
                        .collect()
                })
                .collect();
            // The rows a run adds go again before and after it, untimed, so
            // every run starts from the seed and RETURNING answers the same ids.
            exec(&db, "DELETE FROM posts WHERE id > 500000");
            let mut st = prepare(&db, INSERT_SQL);
            t0 = Instant::now();
            if txn && db.execute_batch("BEGIN").is_err() {
                failed += 1;
            }
            for i in 0..count {
                let body = bodies[(i % 64) as usize].as_str();
                let user = 1 + (i as i64) % USERS;
                let r = st.query_row((user, body), |row| {
                    f.add(row.get::<_, i64>(0)? as u32);
                    // created_at is the clock's: its length is folded, not its bytes.
                    let p = row.get_ref(1)?.as_bytes()?;
                    if p.len() <= f.buf.len() {
                        f.buf[..p.len()].copy_from_slice(p);
                    }
                    f.add(p.len() as u32);
                    Ok(())
                });
                match r {
                    Ok(()) => rows += 1,
                    Err(_) => failed += 1,
                }
            }
            if txn && db.execute_batch("COMMIT").is_err() {
                failed += 1;
            }
            t1 = Instant::now();
            if st.finalize().is_err() {
                failed += 1;
            }
            exec(&db, "DELETE FROM posts WHERE id > 500000");
            exec(&db, "PRAGMA wal_checkpoint(TRUNCATE)");
        }
        _ => {
            eprintln!("twin-rs: unknown workload {mode}");
            exit(2);
        }
    }
    if let Err((_, e)) = db.close() {
        die("close", e);
    }
    let ns = t1.duration_since(t0).as_nanos();
    println!("rows {rows} checksum {} failed {failed} count {count} ns {ns}", f.sum);
}
