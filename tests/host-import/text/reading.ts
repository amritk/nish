// The --emit-ts reading of tests/run.js's `host-import-text` section: under Node
// it calls host.ts's `say` and `measure` with JS strings, the signature the page's
// import object gives them under wasm32, so both readings print the same lines.
import { measure, say } from "./host"

export const main = (): number => {
  say("clef \u{1D11E} é")
  console.log(`${measure("é\u{1D11E}", 7)}`)
  return 0
}
