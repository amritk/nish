// `nish proto <file.proto> -o <out.ts> [--check]`: one proto3 file becomes one
// Nish module of message classes (docs/wp72-proto-classes.md §5). A refused
// file writes nothing; `--check` writes nothing and says whether the module on
// disk is the one this run would write.

import { CLI } from "./branding"
import { basename } from "./paths"
import { emitProto } from "./proto-emit"
import { parseProto } from "./proto-parse"
import { sha256Hex } from "./run-cache"

const PROTO_USAGE: string = "proto <file.proto> -o <out.ts> [--check]"

/** The parsed command line: `status` is the exit status when it is already answered, else -1. */
class ProtoArgs {
  input: string = ""
  out: string = ""
  status: i32 = -1
  check: boolean = false
}

/** A usage error: the message and the usage line, status 2. */
const protoUsage = (args: ProtoArgs, message: string): ProtoArgs => {
  console.error(`proto: ${message}`)
  console.error(`usage: ${CLI} ${PROTO_USAGE}`)
  args.status = 2
  return args
}

/** Reads `nish proto`'s arguments, which follow `proto` in `argv`. */
const protoArgs = (argv: string[]): ProtoArgs => {
  const args = new ProtoArgs()
  let i = 2
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      console.log(`usage: ${CLI} ${PROTO_USAGE}`)
      console.log("  writes a Nish module of message classes, with encode and decode, from a proto3 file")
      console.log("  -o <file>  the module to write; it may not be the .proto itself")
      console.log(
        "  --check    write nothing; exit 1 if the module is missing or not what this run would write"
      )
      args.status = 0
      return args
    }
    if (arg === "-o") {
      let value = ""
      if (i >= 0 && i + 1 < argv.length) {
        value = argv[i + 1]
      }
      if (value.length === 0 || value.startsWith("-")) {
        return protoUsage(args, "-o needs a value")
      }
      if (args.out.length > 0) {
        return protoUsage(args, "one -o at most")
      }
      args.out = value
      i += 2
    } else if (arg === "--check") {
      args.check = true
      i++
    } else if (arg.startsWith("-")) {
      return protoUsage(args, `unknown flag ${arg}`)
    } else if (args.input.length > 0) {
      return protoUsage(args, "one .proto file at most")
    } else {
      args.input = arg
      i++
    }
  }
  if (args.input.length === 0) {
    return protoUsage(args, "no .proto file given")
  }
  if (args.out.length === 0) {
    return protoUsage(args, "no output file given (-o)")
  }
  return args
}

/**
 * Whether `path` holds what the module's `Regenerate:` comment cannot carry:
 * a byte that is not printable ASCII, a quote, a backslash or a comment
 * delimiter.
 */
const protoUnsafePath = (path: string): boolean => {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    const next = i + 1 < path.length ? path.charCodeAt(i + 1) : 0
    if (c < 32 || c > 126 || c === 34 || c === 39 || c === 92) {
      return true
    }
    if ((c === 42 && next === 47) || (c === 47 && next === 42)) {
      return true
    }
  }
  return false
}

/**
 * `path` as one shell word for the `Regenerate:` line: as it is when every
 * character is one a shell leaves alone, else in single quotes (a path with a
 * quote never gets here: `protoUnsafePath` refuses it).
 */
const protoShellWord = (path: string): string => {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    const plain =
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c === 43 ||
      c === 44 ||
      c === 45 ||
      c === 46 ||
      c === 47 ||
      c === 58 ||
      c === 61 ||
      c === 64 ||
      c === 95
    if (!plain) {
      return `'${path}'`
    }
  }
  return path
}

/** Runs `nish proto`; its exit status. */
export const protoCommand = (argv: string[]): i32 => {
  const args = protoArgs(argv)
  if (args.status >= 0) {
    return args.status
  }
  if (protoUnsafePath(args.input) || protoUnsafePath(args.out)) {
    protoUsage(
      args,
      "a path holds a quote, a backslash, a comment delimiter or a byte that is not printable ASCII"
    )
    return 2
  }
  const inAbs = realpathSync(args.input)
  const text = readFileSyncOrNull(args.input)
  if (inAbs === null || text === null) {
    protoUsage(args, `cannot read ${args.input}`)
    return 2
  }
  const outAbs = realpathSync(args.out)
  if (outAbs !== null && outAbs === inAbs) {
    protoUsage(args, `-o ${args.out} is the .proto itself, which the module would overwrite`)
    return 2
  }
  const file = parseProto(text)
  if (file.failure.length > 0) {
    console.error(`proto: ${args.input}:${file.failLine}: ${file.failure}`)
    return 1
  }
  const command = `${CLI} proto ${protoShellWord(args.input)} -o ${protoShellWord(args.out)}`
  const module = emitProto(file, basename(args.input), sha256Hex(text), command)
  if (args.check) {
    const old = readFileSyncOrNull(args.out)
    if (old === null || old !== module) {
      console.error(`proto: ${args.out} is stale; regenerate it`)
      return 1
    }
    return 0
  }
  writeFileSync(args.out, module)
  return 0
}
