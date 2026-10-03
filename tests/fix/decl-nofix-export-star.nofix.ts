// `export * from` re-exports another module's declarations: no fix.
export const main = (): number => 0
export * from "./m"
