// The concurrency check run.mjs makes after conformance: the server coalesces
// reads of one shape that wait together into one statement (worker.ts,
// `batchReads`), so a read made beside many others must answer exactly what
// it answers alone. On a fresh copy of the dev seed, it makes a viewer who
// favorites some articles and follows a commenter, then makes a mix of reads
// (articles with and without the viewer, slugs that match nothing or that
// Postgres refuses, comments, tags) one at a time, then the same reads many
// times over all at once in a shuffled order, then one at a time again, and
// compares every answer's status and body byte for byte. It also reports the
// transactions the database committed for the concurrent reads; run.mjs fails
// when there are not fewer of them than reads, which is no coalescing at all.

/** Answers `{ requests, transactions, mismatches }`; `xacts()` reads the database's committed transactions. */
export const concurrencyCheck = async (base, xacts, { copies = 40 } = {}) => {
  const call = async (method, url, token, body) => {
    const headers = { "Content-Type": "application/json" }
    if (token) {
      headers.Authorization = `Token ${token}`
    }
    const r = await fetch(`${base}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: r.status, body: await r.text() }
  }
  const must = async (method, url, token, body) => {
    const r = await call(method, url, token, body)
    if (r.status >= 300) {
      throw new Error(`concurrency: ${method} ${url} answered ${r.status}: ${r.body}`)
    }
    return JSON.parse(r.body)
  }
  const signUp = async (name) =>
    (
      await must("POST", "/api/users", null, {
        user: { username: name, email: `${name}@example.com`, password: "concurrency-check" },
      })
    ).user.token

  const page = await must("GET", "/api/articles?limit=40", null)
  const slugs = page.articles.map((a) => a.slug)
  const viewer = await signUp(`viewer_${process.pid}`)
  const commenter = await signUp(`commenter_${process.pid}`)
  for (const slug of slugs.slice(0, 10)) {
    await must("POST", `/api/articles/${slug}/favorite`, viewer)
  }
  for (const slug of slugs.slice(0, 5)) {
    await must("POST", `/api/articles/${slug}/comments`, commenter, { comment: { body: `on ${slug}` } })
  }
  await must("POST", `/api/profiles/commenter_${process.pid}/follow`, viewer)
  await must("POST", `/api/profiles/${page.articles[1].author.username}/follow`, viewer)

  // Slugs that match nothing, with the bytes an array literal must escape,
  // and two (a NUL, a byte that is not UTF-8) that Postgres refuses, failing
  // any statement they are coalesced into.
  const missing = [
    "no-such-article",
    "a%22quoted%22",
    "back%5Cslash",
    "%7Bbraces%7D",
    "a%2Cb",
    "caf%C3%A9",
    "%00",
    "%FF",
  ]
  const reads = [["/api/tags", null]]
  for (const slug of [...slugs, ...missing]) {
    for (const token of [null, viewer]) {
      reads.push([`/api/articles/${slug}`, token], [`/api/articles/${slug}/comments`, token])
    }
  }
  const serially = async () => {
    const answers = []
    for (const [url, token] of reads) {
      answers.push(await call("GET", url, token))
    }
    return answers
  }
  const expected = await serially()

  const order = []
  for (let c = 0; c < copies; c++) {
    for (let k = 0; k < reads.length; k++) {
      order.push(k)
    }
  }
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1))
    ;[order[k], order[j]] = [order[j], order[k]]
  }
  // A backend reports its transactions to the statistics up to ten seconds
  // after it goes idle, so each count waits for the last ones to land.
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 11000))
    return xacts()
  }
  const before = await settled()
  const answers = await Promise.all(order.map((k) => call("GET", reads[k][0], reads[k][1])))
  const transactions = (await settled()) - before

  const mismatches = []
  const compare = (k, got, when) => {
    const want = expected[k]
    if (got.status !== want.status || got.body !== want.body) {
      mismatches.push(
        `${when} GET ${reads[k][0]}${reads[k][1] ? " (viewer)" : ""}: ${got.status} ${got.body.slice(0, 120)}, alone ${want.status} ${want.body.slice(0, 120)}`
      )
    }
  }
  order.forEach((k, at) => {
    compare(k, answers[at], "concurrent")
  })
  const again = await serially()
  again.forEach((got, k) => {
    compare(k, got, "serial again")
  })
  return { requests: order.length, distinct: reads.length, transactions, mismatches }
}
