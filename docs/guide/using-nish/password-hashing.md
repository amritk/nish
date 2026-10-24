# Password hashing

`nish/crypto/bcrypt` stores passwords the way most servers already do: as a
bcrypt hash, the 60-character `$2b$10$...` string that OpenBSD, libxcrypt,
PHP's `password_hash` and the bcrypt packages for Node, Python and Go all read
and write. A hash made here verifies there, and the other way round.

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
byte. Both are part of the format: every implementation does the same, so a
hash made here verifies elsewhere. A user who types a 100-character passphrase
is protected by its first 72 bytes only. If you want long passphrases to count
in full, hash the password with `hmacSha256` from `nish/crypto/hmac` under a
server-side key and pass that to bcrypt instead. Hex- or base64-encode the HMAC
first, so it holds no NUL. `BCRYPT_MAX_PASSWORD` is 72, if you want to warn
users at sign-up.

`bcryptVerify` reads hashes that begin `$2a$`, `$2b$` and `$2y$`. They differ
only in how old implementations handled 8-bit bytes and long passwords, and
each is checked the way libxcrypt and crypt_blowfish check it. One case
differs from OpenBSD: a `$2a$` hash OpenBSD made from a password over 254
bytes does not verify here. A `$2x$` hash
comes from a known-buggy implementation and is refused: such a hash cannot be
verified safely, so ask that user to reset their password.

## Keeping a server responsive

A cost-10 hash holds one core for about 50 ms, so a server that hashes on the
thread running its event loop stops answering everyone else while it does. The
module does no I/O and calls no C, so it builds for WebAssembly too.

For now, a hash cannot run inside a [`std/threads`](threads.md) task:
`bcryptHash` and `bcryptVerify` wipe their state before returning, and a task
may not call a function that wipes. Until the compiler allows that, spread the
load across processes instead. Each worker of a forking server hashes on its
own core, so a slow hash stalls only that worker
([A server on every core](networking.md#a-server-on-every-core-nishnetprefork)).
