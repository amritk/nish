# Password hashing

`nish/crypto/bcrypt` stores passwords the way most servers already do: as a
bcrypt hash, the 60-character `$2b$10$...` string that OpenBSD, libxcrypt,
PHP's `password_hash` and the bcrypt packages for Node, Python and Go all read
and write. A hash made here verifies there, and the other way round, but for
the few unusual passwords [below](#what-bcrypt-reads-of-a-password).

The password is a `Secret<u8[]>` ([Secrets](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#secrets-nishsecret)),
so the compiler keeps it out of logs and templates. The hash is computed inside
`exposeWith`, and the Blowfish state it builds (about 4 KB) is wiped before the
function returns. A verify compares the two hashes in constant time.

## Hashing and verifying

`bcryptHash(password, salt, cost)` answers the `$2b$` hash. The salt is 16
bytes, fresh for every password, from `crypto.getRandomValues`, and the hash
carries it, so you store only the hash. `bcryptVerify(password, hash)` answers
whether the password is the one the hash was made from.

```ts nish:ok
import { bcryptHash, bcryptVerify } from "nish/crypto/bcrypt";
import { Secret, secret, wipe } from "nish:secret";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  // At sign-up: a fresh salt, and the hash goes in the database.
  const typed: Secret<u8[]> = secret(bytesOf("correct horse"));
  const salt: u8[] = new Array<u8>(16);
  crypto.getRandomValues(salt);
  const made: Result<string, string> = bcryptHash(typed, salt, 10);
  wipe(typed);
  if (made.isErr()) {
    console.log(made.error);
    return 1;
  }
  const stored: string = made.value;
  console.log(`${stored.length} characters`); // 60 characters

  // At login: the password as typed, against the stored hash.
  const attempt: Secret<u8[]> = secret(bytesOf("correct horse"));
  const ok: Result<boolean, string> = bcryptVerify(attempt, stored);
  wipe(attempt);
  if (ok.isErr()) {
    console.log(ok.error); // a hash that is not bcrypt, or is damaged
    return 1;
  }
  console.log(ok.value ? "welcome back" : "wrong password"); // welcome back
  return 0;
};
```

`bcryptHash` answers an `Err` for a salt that is not 16 bytes or a cost outside
4 to 31. `bcryptVerify` answers `Ok(false)` for a wrong password and an `Err`
only for a string that is not a bcrypt hash it accepts. Treat an `Err` at login
as a failed login too, and log it: it means the stored hash is damaged.

## Choosing the cost

The cost is the base-2 logarithm of the rounds: every step up doubles the time
of a hash, for you and for anyone who has stolen your database and is guessing.
Cost 10 takes about 50 ms of one core, cost 12 about 200 ms. Pick the highest
cost your login rate can afford. The cost is stored in each hash, so raising it
later does not break old hashes: verify as usual, and when a login succeeds
against a hash with a lower cost, hash the password again at the new cost and
store that.

`bcryptVerify` takes the cost from the hash it is given, not from you. A
`$2b$31$` hash runs 2^31 rounds, hours of one core, so verify only hashes your
own server stored, never one a client sends.

## What bcrypt reads of a password

bcrypt reads at most **72 bytes** of a password, and it stops at the first NUL
byte, as libxcrypt and crypt_blowfish do. A user who types a 100-character passphrase
is protected by its first 72 bytes only. If you want long passphrases to count
in full, hash the password with `hmacSha256` from `nish/crypto/hmac` under a
server-side key and pass that to bcrypt instead. Hex- or base64-encode the HMAC
first, so it holds no NUL. `BCRYPT_MAX_PASSWORD` is 72, if you want to warn
users at sign-up.

`bcryptVerify` reads hashes that begin `$2a$`, `$2b$` and `$2y$`. They differ
only in how old implementations handled 8-bit bytes and long passwords, and
each is checked the way libxcrypt and crypt_blowfish check it. Other
implementations answer otherwise for a few passwords: one with a NUL byte, one
over 72 bytes, or one whose 8-bit bytes each follow only 0xff bytes in their
four-byte key word (such as `\xff\xff\xa3`) under `$2a$`.

A hash another implementation made of such a
password may not verify here; the
[interoperability table](../../security/crypto-bcrypt.md#interoperability) in
the security record says which, implementation by implementation. Text in
UTF-8 never holds the third kind. A `$2x$` hash
comes from a known-buggy implementation and is refused: such a hash cannot be
verified safely, so ask that user to reset their password.

## Keeping a server responsive

A cost-10 hash holds one core for about 50 ms, so a server that hashes on the
thread running its event loop stops answering everyone else while it does,
and a burst of sign-ups queues behind one another. Hand the hashing to
[`std/threads`](threads.md) tasks instead: each runs on a core of its own, and
the thread that opened the scope waits for the slowest hash rather than for
all of them in turn. Here three sign-ups that arrived together are hashed side
by side, given a free core for each:

```ts nish:ok
import { bcryptHash } from "nish/crypto/bcrypt";
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

// A fresh salt for each password, drawn on the calling thread.
const freshSalts = (n: i32): u8[] => {
  const salts: u8[] = new Array<u8>(16 * n);
  crypto.getRandomValues(salts);
  return salts;
};

// One password's hash under the salt at `at`: the task's whole job.
const hashAt = (password: Secret<u8[]>, salts: u8[], at: i32): string => {
  const salt: u8[] = new Array<u8>(16);
  for (let i: i32 = 0; i < 16; i++) {
    salt[i] = salts[at + i];
  }
  const made = bcryptHash(password, salt, 10);
  return made.isErr() ? "" : made.value;
};

export const main = (): i32 => {
  // Three sign-ups arrived together; each hash takes a core for about 50 ms.
  const alice: Secret<u8[]> = secret(bytesOf("correct horse"));
  const bob: Secret<u8[]> = secret(bytesOf("battery staple"));
  const carol: Secret<u8[]> = secret(bytesOf("tr0ub4dor&3"));
  const salts: u8[] = freshSalts(3);
  const stored: string[] = ["", "", ""];
  {
    using s = scope();
    s.spawn((p: Secret<u8[]>): string => hashAt(p, salts, 0), alice, stored, 0); // this thread
    s.spawn((p: Secret<u8[]>): string => hashAt(p, salts, 16), bob, stored, 1); // a worker
    s.spawn((p: Secret<u8[]>): string => hashAt(p, salts, 32), carol, stored, 2); // another
  }
  wipe(alice);
  wipe(bob);
  wipe(carol);
  for (const hash of stored) {
    console.log(`${hash.substring(0, 7)} ${hash.length}`); // $2b$10$ 60
  }
  return 0;
};
```

Draw the salts before the scope, on the calling thread: a task may not call
`crypto.getRandomValues`, since it writes through the runtime. A task may
call `bcryptHash` and `bcryptVerify`, and each arrow task reads the salts as a
`const` and takes its password as the task's argument. The passwords stay
`Secret`s throughout, and the server wipes them once the scope has joined,
when no task can still read them.

The scope still joins on the thread that opened it, and runs one of the tasks
there, so that thread is busy for about one hash, not three. On a server, open
the scope on a thread other than the one running the event loop, or accept
that pause of one hash for each burst. The module calls no C and does no I/O
but read the monotonic clock in `bcryptCalibrate`, so it builds for WebAssembly
too, where the tasks run one after another.

## Several at once on one thread

`bcryptHashN(p0, p1, p2, p3, p4, p5, salts, cost)` and
`bcryptVerifyN(p0, p1, p2, p3, p4, p5, hashes)` take up to six passwords and
run their hashes interleaved on the calling thread, since the chains of table
lookups overlap where one would leave the core waiting. Lane 0 is always given
and a `null` lane is skipped.

Each lane answers what `bcryptHash` or `bcryptVerify` would (a skipped lane
answers `""` or `false`), `salts` is the six 16-byte salts end to end (96
bytes), `hashes` is six strings, and a verify of hashes with different costs
runs each cost as its own group. A malformed hash in any given lane makes the
whole verify an `Err` that names the lane, before anything is hashed.
`bcryptHash4` and `bcryptVerify4` are the same for up to four passwords, with
64 bytes of salts.

How many lanes are fastest per hash depends on the core: a core that issues
more instructions a cycle gains from wider batches, and on one Xeon five and
six lanes were no faster than four while on a newer one six were fastest
([the measurements](../../security/crypto-bcrypt.md#bmi2-and-x86-64-v3-measured-not-built)).
So measure it rather than pick a number. `bcryptCalibrate()` times
each width from one to six on throwaway passwords and returns the fastest. It
takes a few tens of milliseconds and keeps nothing, so call it once, at
startup, and keep the answer:

```ts nish:ok
import { bcryptCalibrate } from "nish/crypto/bcrypt";

export const main = (): i32 => {
  // Once, at startup: the batch width this core hashes fastest at.
  const width: i32 = bcryptCalibrate();
  console.log(`hashing logins ${width} at a time`);
  return 0;
};
```

A task may call the batch too: the `Secret` it makes its state in comes from
an array the call made, so its wipe is the task's own scratch
([BCRYPT-9](../../security/crypto-bcrypt.md#findings)).

## A login batcher

How full a batch is moves the time per password more than anything else: on
one core a full six-lane batch at cost 10 takes about 16 ms a hash, and a lone
hash 57 ms. A server whose logins arrive one at a time never fills a batch by
itself. `nish/crypto/bcrypt-batch` holds them until it can:

- `bcryptBatcher({ width, holdNanos, cores, cost })` makes a batcher, or an
  `Err` for a width outside 1 to 6, a negative hold, no cores or a cost
  outside 4 to 31. Give it `bcryptCalibrate()`'s width and
  `availableParallelism()` cores.
- `verify(password, hash, now)` and `hash(password, salt, now)` queue a
  request that arrived at `now` (`monotonicNanos()`) and answer its ticket.
  The batcher keeps its own copy of the password; wipe yours as you would
  after `bcryptVerify`.
- `waitNanos(now)` is how long the server may wait for more logins before a
  run is due: 0 when one is, -1 when nothing is queued.
- `run(now)` sends the work that is due, as `bcryptVerifyN` and `bcryptHashN`
  batches on one task per core, and answers a `BcryptAnswer` for each request
  it ran: its `ticket`, `ok`, the new `hash` for a hash request, and `error`
  for one that was an `Err`. A run is due when `width` requests are queued or
  the oldest has waited `holdNanos`.

```ts nish:ok
import { bcryptCalibrate, bcryptHash } from "nish/crypto/bcrypt";
import { BcryptAnswer, BcryptBatchConfig, BcryptBatcher, bcryptBatcher } from "nish/crypto/bcrypt-batch";
import { Secret, secret, wipe } from "nish:secret";
import { availableParallelism, monotonicNanos } from "nish:process";

const typed = (): Secret<u8[]> => {
  const raw: u8[] = [104, 117, 110, 116, 101, 114, 50];
  return secret(raw);
};

export const main = (): i32 => {
  const pw: Secret<u8[]> = typed();
  const stored: Result<string, string> = bcryptHash(pw, new Array<u8>(16), 10);
  wipe(pw);
  if (stored.isErr()) {
    return 1;
  }
  // Once, at startup. A hold of 0 sends what is queued at once; see below.
  const hold: i64 = 0;
  const config: BcryptBatchConfig = {
    width: bcryptCalibrate(),
    holdNanos: hold,
    cores: availableParallelism(),
    cost: 10,
  };
  const made: Result<BcryptBatcher, string> = bcryptBatcher(config);
  if (made.isErr()) {
    console.log(made.error);
    return 1;
  }
  const batcher: BcryptBatcher = made.value;

  // Three logins arrive.
  for (let i: i32 = 0; i < 3; i++) {
    const attempt: Secret<u8[]> = typed();
    batcher.verify(attempt, stored.value, monotonicNanos());
    wipe(attempt);
  }

  // The server's loop: wait for more logins at most waitNanos, then run.
  while (batcher.pending() > 0) {
    const now: i64 = monotonicNanos();
    if (batcher.waitNanos(now) === 0) {
      const answers: BcryptAnswer[] = batcher.run(now);
      for (const a of answers) {
        console.log(`login ${a.ticket}: ${a.ok ? "welcome back" : "wrong password"}`);
      }
    }
  }
  return 0;
};
```

`run` takes at most `width × cores` requests, the oldest first, and spreads
them evenly over the cores rather than filling one batch, so a run takes about
one batch's time. Under load the logins that arrive during a run fill the next
one, so the batches fill by themselves; at light load each login runs alone
on a core, as a task per login would.

The hold lets a part batch wait up to `holdNanos` to fill before it goes. In
[the measurements](../../security/crypto-bcrypt.md#the-login-batcher-measured)
a 5 ms hold beat a hold of 0 nowhere and added its 5 ms to light-load
latency, since under load the logins that arrive during one run fill the next.
Start from 0.

On that 4-core machine, at cost 10, the batcher answered 1.9 to 2.3 times as
many logins a second as a process per core once logins arrived faster than
those processes could answer (about 67 a second): up to about 150 a second.
On one core it never lost. **At light load on several cores one batcher is
slower**: at 10 to 60 logins a second a process per core answered sooner,
because a login that arrives during a run waits for that run to end while
the other processes are idle.

**On several cores, run one batcher per process.** A
[prefork server](networking.md#a-server-on-every-core-nishnetprefork), one
worker process a core, each with a batcher of `cores: 1`, gets both: a login
that arrives while one worker is busy goes to another, and the logins that
queue at a busy worker share its next batch. In each worker, the config above
becomes:

```ts
const config: BcryptBatchConfig = { width: bcryptCalibrate(), holdNanos: hold, cores: 1, cost: 10 };
```

In [the measurements](../../security/crypto-bcrypt.md#one-batcher-per-process)
it was level with a process per core at 10 and 30 logins a second, faster
than both at 60, and answered as many logins a second as one batcher over
every core under load, with lower latency. Those workers were dealt logins
round-robin. `SO_REUSEPORT` spreads connections by a hash of their addresses
instead, so it can hand a login to a busy worker while another is idle, and
that login waits as it would for one batcher.

`run` blocks its thread until every task has finished, about one batch: run
the batcher on a thread other than the event loop's. A request is wiped only
once it has run, so call `run` until `pending()` is 0 before dropping a
batcher ([BCRYPT-11](../../security/crypto-bcrypt.md#findings)).
