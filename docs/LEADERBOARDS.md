# Leaderboards

Public leaderboards that rank a Nish entry. Each is run by a third party,
who measured every entry on their own hardware under their own rules, so
every figure on this page is theirs, quoted from the result they published.
An entry is listed here only once its leaderboard has published it. None of these
runs come from this repository's bench suite; that suite is in
[Benchmarks](BENCHMARKS.md).

## Multicore server challenge

**Second on the leaderboard: 220,000 users held on 8 cores.**

| | |
| --- | --- |
| Challenge | [arjaythedev/multicore-server-challenge](https://github.com/arjaythedev/multicore-server-challenge) |
| Video | [Which Programming Language Can Handle the Most Users on 8 Cores?](https://www.youtube.com/watch?v=TIyvOtGjnzc) (Arjay McCandless, published 2026-11-13); the Nish entry's chapter, "#2 Nish", starts at [19:19](https://www.youtube.com/watch?v=TIyvOtGjnzc&t=1159s) |
| Entry | [`submissions/nish-std-amritk`](https://github.com/arjaythedev/multicore-server-challenge/tree/main/submissions/nish-std-amritk), last updated by [arjaythedev/multicore-server-challenge#225](https://github.com/arjaythedev/multicore-server-challenge/pull/225) (merged 2026-11-07) |
| Leaderboard | [benchmarks.arjaythedev.com/multicore](https://benchmarks.arjaythedev.com/multicore), also as [LEADERBOARD.md](https://github.com/arjaythedev/multicore-server-challenge/blob/main/LEADERBOARD.md) in the repository |
| Compiler | Nish 0.35.0 |

### The video

<scalar-embed
  src="https://www.youtube.com/embed/TIyvOtGjnzc"
  caption="Which Programming Language Can Handle the Most Users on 8 Cores? (Arjay McCandless)"
  alt="The organiser's video counting down the top 10 entries of the multicore server challenge">
</scalar-embed>

The organiser's video walks through the code of the top 10 entries on the
leaderboard, in Java, F#, Assembly, Swift, C, Zig, Rust and Nish. It
follows one request through each system down into Postgres, then looks at
what each submission changed along that path and the commits that moved
its score. The entries are counted down from #10, and Nish is #2, in the
chapter at [19:19](https://www.youtube.com/watch?v=TIyvOtGjnzc&t=1159s).
On 2026-11-19 the video had 68,280 views and about 1,000 likes, and the
channel had 138,000 subscribers.

### The challenge

The question is how many users one 8-core server can handle. Each entry
implements the RealWorld "Conduit" API (a Medium clone, 19 endpoints) on
Postgres 18, on a box with 8 vCPUs and 16 GB of RAM. The challenge's rules
apply to every entry:

- nothing is cached across requests, and every write is committed before
  the response goes out;
- every password is hashed with bcrypt at cost 10, and a login is verified
  against the stored hash;
- every request's JWT has its HS256 signature and `exp` checked;
- the Postgres configuration and the schema are fixed.

The score is the largest number of users that passes a 5-minute hold with a
p95 latency under 500 ms, a p99 under 1 s and fewer than 1% errors. The
organiser warms each server up for 3 minutes (not scored), runs 2-minute
probes to find the limit, and then holds at it for 5 minutes.

The challenge is now closed, and its leaderboard keeps every result.

### The result

The organiser's run at the entry's commit `9913ccf` held 220,000 users for
5 minutes:

| users held | req/s | p50 | p95 | p99 | errors |
| ---: | ---: | ---: | ---: | ---: | --- |
| 220,000 | 55,077 | 226 ms | 372 ms | 459 ms | 0 (1 timeout in 16.5M requests) |

The probes passed up to 220,000 users and failed at 230,000 (p95 1,279 ms,
p99 2,499 ms). The leaderboard's row gives p99 as 458 ms; the table above
quotes the organiser's comment on the PR.

The top of the leaderboard:

| place | users held | entry | req/s | p95 | p99 |
| ---: | ---: | --- | ---: | ---: | ---: |
| 1 | 230,000 | rust-epoll-theCatWisel | 58,865 | 257 ms | 394 ms |
| **2** | **220,000** | **nish-std-amritk** | **55,077** | **372 ms** | **458 ms** |
| 3 | 220,000 | rust-epoll-WorriedArrow | 55,855 | 314 ms | 608 ms |
| 4 | 220,000 | zig-iouring-nick-potts | 55,763 | 316 ms | 438 ms |

Three entries held 220,000 users. The leaderboard and the organiser's video
both rank Nish second of them, with rust-epoll-WorriedArrow third and
zig-iouring-nick-potts fourth. The leaderboard has 127 rows. For comparison, the example servers it lists in Go, Rust, Java and
Python held 24,000, 22,000, 21,000 and 10,000 users.

### How the entry got there

The entry is one native binary built with the standard library:
`nish/net/http1-server` for HTTP/1.1, `nish/net/postgres` for the database
(its `PgBatcher` included), `nish/json`, `nish/crypto/hmac` for the JWTs
and `nish/crypto/bcrypt`. A supervisor preforks the processes
(`nish/net/prefork`): HTTP workers that each bind the port with
`SO_REUSEPORT` and run their own epoll loop, one read service that holds
the read plans, and bcrypt services. There is no Nginx in front.

PR 225 moved the entry up from 210,000 users (52,522 req/s, p95 339 ms,
p99 400 ms in the organiser's run before it) with three changes:

1. **Reads by key are planned apart from lists.** Every read of a plan
   waits for the plan's slowest statement, and the lists and feeds are the
   slowest; an article page or a comment thread no longer waits for a feed.
2. **Sign-ups share the login batches.** A sign-up used to hash alone, in
   a one-lane `bcryptHashN` call; now it fills a free lane of a login
   batch, about 7 ms instead of 58 ms.
3. **The spare bcrypt services run at `nice 10`.** Logins fill one
   service's batches before the next, and the other services' bursts yield
   the CPU to Postgres. The idea is credited in the PR to the
   rust-epoll-theCatWisel entry.

The entry passes the challenge's conformance suite, 197 of 197 checks, on
Nish 0.35.0. The source is in
[`submissions/nish-std-amritk`](https://github.com/arjaythedev/multicore-server-challenge/tree/main/submissions/nish-std-amritk).
