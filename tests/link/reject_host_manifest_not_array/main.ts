// NL2694: a `nish.host` that is one string rather than an array is refused
// before the module it names is read, which as Nish would only be refused for
// its `any`.
import { first } from "./src/host"

export const main = (): number => first(0)
