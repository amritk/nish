// Reading a request target allocates nothing: one query iterator, one path
// iterator and one output buffer, made once and reused for every target, with
// `Arena.used()` measured across each call the way
// tests/link/std_json_tokenizer/alloc.ts measures a body.
import {
  URL_DECODE_FORM,
  URL_QUERY_END,
  URL_QUERY_PAIR,
  UrlPathSegments,
  UrlQuery,
  UrlQueryLimits,
  percentDecode,
  percentDecodePathSegment,
  urlQueryFind,
  urlQueryStart,
} from "nish/net/url"

/** Targets after the warm-up, every one measured. */
const URL_ALLOC_ROUNDS: i32 = 10000

const TARGET: string = "/api/v1/caf%C3%A9/items?name=J%20Doe&q=a+b%2Bc&flag&page=7"

/**
 * One request: a digit of the target rewritten for round `k`, so nothing can
 * be computed once, then every path segment and every pair decoded and one key
 * looked up. Answers a checksum of what it read, or -1 on a refusal.
 */
const urlOneRequest = (path: UrlPathSegments, q: UrlQuery, target: u8[], out: u8[], k: i32): i64 => {
  const n: i32 = toI32(target.length)
  target[n - 1] = toU8(48 + (k % 10))
  const at: i32 = urlQueryStart(target, 0, n)
  let sum: i64 = toI64(at)
  path.reset(target, 0, at)
  while (path.next()) {
    const w: i32 = percentDecodePathSegment(path.bytes, path.start, path.length, out, 0, 0)
    if (w < 0) {
      return -1
    }
    sum = sum + toI64(w)
  }
  q.reset(target, at + 1, n - at - 1)
  let kind: i32 = q.next()
  while (kind === URL_QUERY_PAIR) {
    const w: i32 = percentDecode(target, q.valueStart, q.valueLength, out, 0, URL_DECODE_FORM)
    if (w < 0) {
      return -1
    }
    sum = sum + toI64(w) + toI64(q.keyLength)
    kind = q.next()
  }
  if (kind !== URL_QUERY_END) {
    return -1
  }
  q.reset(target, at + 1, n - at - 1)
  if (urlQueryFind(q, "page") === URL_QUERY_PAIR) {
    sum = sum + toI64(target[q.valueStart])
  }
  return sum
}

export const main = (): i32 => {
  const target: u8[] = new Array<u8>(toI32(TARGET.length))
  let i: i32 = 0
  while (i < toI32(TARGET.length)) {
    target[i] = toU8(TARGET.charCodeAt(i))
    i += 1
  }
  const out: u8[] = new Array<u8>(toI32(target.length))
  const path: UrlPathSegments = new UrlPathSegments()
  const q: UrlQuery = new UrlQuery(new UrlQueryLimits())
  let checksum: i64 = 0
  let k: i32 = 0
  while (k < 5) {
    checksum = checksum + urlOneRequest(path, q, target, out, k)
    k += 1
  }
  let kept: i64 = 0
  let failures: i32 = 0
  k = 0
  while (k < URL_ALLOC_ROUNDS) {
    const before: i64 = Arena.used()
    const got: i64 = urlOneRequest(path, q, target, out, k)
    kept = kept + (Arena.used() - before)
    if (got < 0) {
      failures += 1
    }
    checksum = checksum + got
    k += 1
  }
  // The meter is not blind: a call that does keep something shows up.
  const control: string[] = []
  const before: i64 = Arena.used()
  control.push(`kept ${k}`)
  const seen: i64 = Arena.used() - before
  console.log(`rounds ${k} failures ${failures} kept ${kept} control ${seen > 0 ? "seen" : "missed"} checksum ${checksum}`)
  return 0
}
