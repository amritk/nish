# Password hashing

`nish/crypto/bcrypt` stores passwords the way most servers already do: as a
bcrypt hash, the 60-character `$2b$10$...` string that OpenBSD, libxcrypt,
PHP's `password_hash` and the bcrypt packages for Node, Python and Go all read
and write. A hash made here verifies there, and the other way round, but for
the few unusual passwords [below](#what-bcrypt-reads-of-a-password).

The password is a `Secret<u8[]>` ([Secrets](../../LANGUAGE.md#secrets-nishsecret)),
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
four-byte key word (such as `\xff\xff\xa3`) under `$2a$`. A hash another implementation made of such a
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
that pause of one hash for each burst. The module does no I/O and calls no C, so
it builds for WebAssembly too, where the tasks run one after another.

## Four at once on one thread

`bcryptHash4(p0, p1, p2, p3, salts, cost)` and
`bcryptVerify4(p0, p1, p2, p3, hashes)` take up to four passwords and run
their hashes interleaved on the calling thread: four take about the time of
1.2 single hashes on one core, since the four chains of table lookups overlap
where one would leave the core waiting. Lane 0 is always given and a `null`
lane is skipped. Each lane answers what `bcryptHash` or `bcryptVerify` would
(a skipped lane answers `""` or `false`), `salts` is the four 16-byte salts
end to end, and a verify of hashes with different costs runs each cost as its
own group. A malformed hash in any given lane makes the whole verify an `Err`
that names the lane, before anything is hashed.

A task may call the batch too: the `Secret` it makes its state in comes from
an array the call made, so its wipe is the task's own scratch
([BCRYPT-9](../../security/crypto-bcrypt.md#findings)). On a server with
spare cores, hash singly on tasks as above, or give each task a batch of four;
on one core, batch the logins that arrive together.
