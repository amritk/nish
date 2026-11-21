// nish/net/protobuf: the reference implementation's vectors decode and
// re-encode byte for byte, every wire type is skipped, and each refusal and
// misuse answers its code.
import { protobufChecks } from "./checks"

export const main = (): i32 => protobufChecks()
