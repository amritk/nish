// The interop server's command line (see `main.ts`): `serve` and its flags,
// the identity it serves with, and the exit codes the interop job and the
// quic-interop-runner read.
import { Secret, wipe } from "nish:secret";
import { InteropOptions, InteropServer, supportedTestcase } from "./server";
import { certificateHash, loadChain, loadKey, mintCertificate, mintKey } from "./identity";

/** The decimal number `text` spells, or -1. */
const decimal = (text: string): i32 => {
  let n: i32 = 0;
  const length: i32 = toI32(text.length);
  if (length === 0 || length > 6) {
    return -1;
  }
  for (let k: i32 = 0; k < length; k++) {
    const digit: i32 = toI32(text.charCodeAt(k)) - 48;
    if (digit < 0 || digit > 9) {
      return -1;
    }
    n = n * 10 + digit;
  }
  return n;
};

/** A port argument, or -1 outside 0 to 65535. */
const port = (text: string): i32 => {
  const n: i32 = decimal(text);
  return n > 65535 ? -1 : n;
};

/** The parsed command line after `serve`, and where it stopped making sense. */
export class ServeArgs {
  options: InteropOptions;
  certs: string = "";
  hashFile: string = "";
  error: string = "";

  constructor() {
    this.options = new InteropOptions();
  }
}

/** Reads `argv[2 ..]` as flag and value pairs. */
export const parseServe = (argv: string[]): ServeArgs => {
  const out = new ServeArgs();
  const o: InteropOptions = out.options;
  let k: i32 = 2;
  while (k < toI32(argv.length) && out.error === "") {
    const flag: string = argv[k];
    if (k + 1 >= toI32(argv.length)) {
      out.error = `${flag} wants a value`;
      return out;
    }
    const value: string = argv[k + 1];
    if (flag === "--www") {
      o.www = value;
    } else if (flag === "--certs") {
      out.certs = value;
    } else if (flag === "--testcase") {
      o.testcase = value;
    } else if (flag === "--host") {
      o.host = value;
    } else if (flag === "--port") {
      o.quicPort = port(value);
    } else if (flag === "--h1-port") {
      o.h1Port = port(value);
    } else if (flag === "--h1s-port") {
      o.h1sPort = port(value);
    } else if (flag === "--h2-port") {
      o.h2Port = port(value);
    } else if (flag === "--hash-file") {
      out.hashFile = value;
    } else {
      out.error = `unknown flag ${flag}`;
    }
    k = k + 2;
  }
  if (out.error === "" && (o.quicPort < 0 || o.h1Port < 0 || o.h1sPort < 0 || o.h2Port < 0)) {
    out.error = "a port outside 0 to 65535";
  }
  return out;
};

/** Runs the server with `key` for `chain` until a signal stops it. */
const run = (args: ServeArgs, chain: u8[][], key: Secret<u8[]>): i32 => {
  const server = new InteropServer(args.options, chain);
  if (server.udp < 0) {
    console.log(`bind failed: ${server.udp}`);
    return 1;
  }
  server.watchSignals();
  server.logging = true;
  server.h2.logging = true;
  const hash: string = certificateHash(chain[0]);
  if (args.hashFile !== "") {
    writeFileSync(args.hashFile, `${hash}\n`);
  }
  console.log(server.ports());
  console.log(`sha256 ${hash}`);
  while (!server.stopped) {
    server.step(toI32(1000), key);
  }
  console.log("stopped");
  return 0;
};

/** `serve`, given the whole `process.argv`: the identity from `--certs` or minted, then `run`; answers the exit code. */
export const serve = (argv: string[]): i32 => {
  const args: ServeArgs = parseServe(argv);
  if (args.error !== "") {
    console.log(`usage: ${args.error}`);
    return 2;
  }
  if (!supportedTestcase(args.options.testcase)) {
    console.log(`unsupported test case ${args.options.testcase}`);
    return 127;
  }
  if (args.certs !== "") {
    const chain: u8[][] | null = loadChain(args.certs);
    const loaded: Secret<u8[]> | null = loadKey(args.certs);
    if (loaded === null) {
      console.log(`no P-256 key in ${args.certs}/priv.key`);
      return 3;
    }
    if (chain === null || toI32(chain.length) === 0) {
      console.log(`no certificate in ${args.certs}/cert.pem`);
      wipe(loaded);
      return 3;
    }
    const code: i32 = run(args, chain, loaded);
    wipe(loaded);
    return code;
  }
  const key: Secret<u8[]> = mintKey();
  const der: u8[] = mintCertificate(key, toI64(Date.now()));
  const code: i32 = toI32(der.length) > 0 ? run(args, [der], key) : 3;
  wipe(key);
  return code;
};
