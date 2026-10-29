// Fetches a JSON document over HTTP or HTTPS with `nish/net/http-client` and
// prints the fields named on the command line, or the whole document when
// none are named:
//
//     build/nish examples/http-get-json.ts --link build/http-get-json
//     build/http-get-json https://api.github.com/repos/amritk/nish full_name stargazers_count
//
// It follows a redirect on the same origin, refuses a body past 4 MiB, and
// says why a fetch failed (an `HTTP_E_*` name and its text). The server's
// chain is checked against the system's roots, or the PEM file
// `SSL_CERT_FILE` names. It exits 0 on a 2xx JSON answer, 1 on any failure,
// and 2, with how to run it, without a URL.
// smoke: exit 2
import { jsonField } from "nish/json"
import { HttpClient, HttpOptions, HttpRequest, HttpResponse } from "nish/net/http-client"
import { getenv } from "nish:process"

/** The most of a body this reads; a larger one is refused rather than held. */
const MAX_BODY: i32 = 4194304

export const main = (): i32 => {
  const args = process.argv
  if (args.length < 2) {
    console.error("usage: http-get-json <url> [field ...]")
    console.error("  prints each field of the JSON object at <url>, or the whole document")
    return 2
  }
  const req: HttpRequest = new HttpRequest("GET", args[1])
  req.header("Accept", "application/json")
  // api.github.com refuses a request without one.
  req.header("User-Agent", "nish-http-get-json")

  const options: HttpOptions = new HttpOptions()
  options.followRedirects = true
  options.totalTimeoutMs = 30000
  const roots: string | null = getenv("SSL_CERT_FILE")
  if (roots !== null && roots !== "") {
    options.rootsPemPath = roots
  }

  const client: HttpClient = new HttpClient(options)
  const res: HttpResponse | null = client.fetch(req)
  if (res === null) {
    console.error(client.errorText)
    return 1
  }
  const body: u8[] | null = res.body.readAll(MAX_BODY)
  if (body === null) {
    console.error(client.errorText)
    client.close()
    return 1
  }
  client.close()
  const text: string = String.fromBytes(body, 0, toI32(body.length))
  if (res.status < 200 || res.status > 299) {
    console.error(`${res.status} ${res.reason} from ${res.url}`)
    console.error(text)
    return 1
  }
  const type: string | null = res.header("content-type")
  if (type === null || type.indexOf("json") < 0) {
    console.error(`${res.url} did not answer JSON`)
    return 1
  }

  if (args.length === 2) {
    console.log(text)
    return 0
  }
  let missing: i32 = 0
  for (let i: i32 = 2; i < toI32(args.length); i += 1) {
    const name: string = args[i]
    const value: string | null = jsonField(text, name)
    if (value === null) {
      console.log(`${name}: (absent)`)
      missing += 1
    } else {
      console.log(`${name}: ${value}`)
    }
  }
  return missing > 0 ? 1 : 0
}
