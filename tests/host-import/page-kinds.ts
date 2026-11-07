// tsc's refusal the `host-import` section pins: a handle of one kind where the
// host function takes another, which nish refuses as NL2103.
import type { HostHandle } from "nish"
import { hSame } from "./host"

type Socket = HostHandle<"socket">
export const wrong = (s: Socket): number => hSame(s)
