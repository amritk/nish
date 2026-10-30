// Writes feed.json: a deterministic stand-in for the feed API's largest
// response, about 5.1 KB of JSON that gzip -6 takes to about 1.9 KB. The
// syllable titles and hex hashes give it the entropy of real headlines and
// asset ids; the repeated keys give it the structure. `feedJson(n)` builds the
// same shape with `n` items, for small.mjs's other sizes.
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

/** The feed with `count` items, from the same seed every call. */
export const feedJson = (count) => {
  let seed = 12345
  const r = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const pick = (a) => a[Math.floor(r() * a.length)]
  const syl =
    "ba be bi bo ka ke ki ko ra re ri ro ta te ti to na ne ni no la le li lo sa se si so ma me mi mo da de di do".split(
      " "
    )
  const word = () => {
    const n = 1 + Math.floor(r() * 3)
    let w = ""
    for (let i = 0; i < n; i++) {
      w += pick(syl)
    }
    return w
  }
  const words = (n) => Array.from({ length: n }, word).join(" ")
  const hex = (n) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("")
  const items = []
  let t = 1761600000
  for (let i = 0; i < count; i++) {
    const id = 900000 + Math.floor(r() * 99999)
    t -= Math.floor(r() * 3600)
    items.push({
      id,
      type: pick(["article", "video", "gallery"]),
      title: words(5 + Math.floor(r() * 5)),
      summary: words(13 + Math.floor(r() * 6)),
      url: `https://news.example.com/${word()}/${id}-${words(3).replaceAll(" ", "-")}`,
      author: {
        id: Math.floor(r() * 500),
        name: pick(["Ana Ruiz", "Sam Okafor", "Lee Chen", "Mia Novak", "Omar Haddad"]),
      },
      // biome-ignore lint/style/useNamingConvention: the feed's field name
      published_at: new Date(t * 1000).toISOString(),
      image: { url: `https://img.example.com/${id}/${hex(32)}.jpg`, width: 1200, height: 675 },
      tags: [word(), word()],
      comments: Math.floor(r() * 400),
      score: Math.round(r() * 1000) / 100,
    })
  }
  return JSON.stringify({ feed: "home", version: 3, cursor: hex(12), items })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = feedJson(11)
  fs.writeFileSync(new URL("feed.json", import.meta.url), text)
  console.log(
    `feed.json: ${text.length} bytes; gzip -1 ${zlib.gzipSync(text, { level: 1 }).length}, -6 ${zlib.gzipSync(text, { level: 6 }).length}`
  )
}
