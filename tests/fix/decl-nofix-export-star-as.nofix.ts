// `export * as ns from` re-exports another module as a namespace: no fix.
export const main = (): number => 0
export * as ns from "./m"
