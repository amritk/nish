// The `net_protobuf` checks again, compiled with `--number-mode f64`: the
// module spells every width it uses, so a program in either mode imports it
// and gets the same answers.
import { protobufChecks } from "../net_protobuf/checks"

export const main = (): i32 => protobufChecks()
