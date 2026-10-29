// The p384 family's Nish program: ECDSA P-384 verification from
// std/crypto/p384, under the contract in bench/crypto/README.md.
// bench/crypto/run.mjs builds it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
// The inputs the kernel draws, and what it folds, are in this family's
// README.md. nish/crypto/p384 verifies but cannot sign, so the public key and
// the ring's signatures are embedded, made once by ring.mjs.
import { p384VerifySha384 } from "nish/crypto/p384"
import { Args, baseOf, fold, foldStart, Inputs, inputs, now, parseArgs, report, tweak } from "../lib/gen"

/** Messages the verify kernel cycles through. */
const RING: i32 = 16

/** The ring entry whose message is changed after it was signed, so its verify must answer false. */
const TAMPERED: i32 = 1

/** The message size the embedded signatures were made for. */
const SIZE: i32 = 64

/** The public key of the input stream's scalar, uncompressed: nish/crypto/p384 cannot derive it. */
const PUB: string =
  "04a90cd12ee786038458a55a38344afd5434f7aa00b59a071f658aa00b74ef06c357e8a282c72151d5437011183dc57c268a45853794ad0751bcc9fadcc6195d9f01ba36b01dbb6e27706a1973327f04d87ce2c280ab96559dda6b9abce977bc9a"

/** Each ring entry's 96-byte signature, r || s, in turn: made by ring.mjs for 64-byte messages. */
const RING_SIGS: string =
  "88eb2125b0383ebadce15815809a5557d7d0f081f7c894537b1a49d1369b868961f658f224a6ffaf0bc5118a35fab1233b4379a7b169622514ff3ae88d3b728c58765b64130bcee81d49ae7e12b5abe0991a03446e7e1eb01915c0b9b055a4fad34e12127d18b7dcc6440593e7f5f2c639810c4d06ca014f131b648b99a8409525e5ef23093280c601301ad3098f2049ea20807394565fa74e8817f3809936ba3da80c9157987d3164566d0ea966814f45e03d9aa21e4baa6df5e73b611af1b0f9baf69b6b86d3b0a8a7fd570214d946f48664865eeba966957e39321f7df3a04107ccb6b3c8b605d834f5edb94aab33647eb508ff8ac148debbf7c4296a3ef5f3c588a7c3240488532678b288b24aecfd7542269df3683340610c63723b4de6f033ebd1b3155dc48872c1cb4c570d4fde190648591dfcf497d9fdf88ca8a33d7f50d6782c7290713e80e5e98c4fc99042c475912cf489b440adf229b5d66ab7822627e3d0302208607b5890edc37ce87753355f63fc9f89fc23a5b53ffbd886d4e85eec5844f6b96ebac1e442c25ee732053c2c575da5e2d8c7ac72ac56f694b6c6cb24b045f7290d03d025c2d4211e468aed79b09c6ae83ab2988a1dea30b668ac4e901373c0b536b0ee439ed59ab2ce535ce8ce2bfe64f6599e16ea5b31ee1abb9a5c0ed84e8477f35164696216c005453d6d1e2b332d2ef624b7ab7ef2b4debe3469b0c55bd9104a4ff1a4d8a2b7cb27963a77533564981e4d55f3f55390b568960cf1bc9d605a68373ae77e7e70869384e02f61570e5d3824d3ae6b131400518026e5efca0e7e0820178cab8d5b054bbdce7ffef24afc5e863228c1996b186d6855748d6019665688ce7678b1cc86a7f61770310447de6ca1e6f52240f7545828518c302d0c0bb527a7bc06d0e1f8eab22a79cf54d15519d2b90dfe481410e5487b22fd8dc1868554c8881be3bd42a2365233fc23898e1f53afcf399f4d3e16dd71b5a81beccc36700b073177a0118d5d106101fdf64f07400aa8f00a8fb568c84e28f3c847f3af0da2190dff444a4f942e2d73b31e51feb765ad0b95a213df8d0e86508c1b08d6a352bd2132569f40b8c83ad2c2a0a05dc12d9f0c34280c53cf74a5be9b999b5f61ad989e1d3dbc8eeef3c6bdc612df95e42b1e2a04ce63651e83918cb1f99b5509fbab245a07526502294f574ba68ae5751de20e4839c92650a330652e480535ba6867080005b3186d9f31b9901bab8171d6c1f624f447aa63f077e78fcb58c31c8d0fff682b688966c412081fd8b2ee13320b6f50185955642e1c4b0622ee6e165cbe6d3d3df8fdfbd936fc446803ac8ca5dae6382609832a24905d2ed803da2651e2041b29b17a8d9a0677cf05370d23336727fb6e20c9f16b89811da42c1af1de19c54171655905d052ef2707c999904ed32036252d675592420ee7716ea7487b0ea6406f9480195d03de18555bee3b0b517accdb2bf7189291cdab34912db7e8d2e63bc02a128f2260713f8b9f1239cbab05abe252acc6b71ce3bbae97e884cc0dbbc18674bb53eef22ebc69852815a83b28ad3ac33c73060a3af9b861602f65d417f7887815e8ab910c6f465b89b95ca2b70766568e7c345afc6ec8ccfadf16e64a6317c7a8e8b252071c1f640c8bfc9a74777e00eee1913816742299d152e0ad931ba4ecd65ee71a8f07cb51bb0e034b5b275fb12daae9a7f009a73103836338a2ae123545522c5f06b3e80ece0074f071fc8093f6cec625ca2115d0c86ca6ed8ed792787abdc3803addc9b722f2efd512be7cf179573ffac5fd99a8f240c6e70a0850d3abcacf66f97b2b4a459eac48b240ec284e07e87c68ca9e3ddc139abf6f82af26066deb77b79979f767b6aab14af71f44aa65048a013226a874d669decff74527f3aebc19ca9c4c7bae9240e443a3d1ce898acd98bc7b97fa5e8b26f0f59213391d6e2cc953d5664028c837aab487e791a7485b2cf9242d7c0744d5b7b449035c8198c48ab5ae5c86c26c4b4e517e79264624d16280de5a86a6358eeaf429873492f8bbd2b6c2653bdf50177a43048f8ad4a9b738f461488549433df9ab227e5c7ec5d3fed4c05e070e88cb1fbb969a451ab716d7dc494fb4d40b6e669a1830b31e39ec10eec4f418357eec03aa4c2c"

/** A fresh copy of `bytes`. */
const copyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length)
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    if (i < toI32(out.length)) {
      out[i] = bytes[i]
    }
  }
  return out
}

/** One lowercase hex digit's value. */
const nibble = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48)

/** `text`, two lowercase hex digits a byte, as bytes. */
const fromHex = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length / 2)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8((nibble(text.charCodeAt(2 * i)) << 4) | nibble(text.charCodeAt(2 * i + 1)))
  }
  return out
}

/** ECDSA P-384 verify, SHA-384 included, over a ring of signed messages, one of them tampered with. */
const verifyLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 48, 0, 0, a.size)
  const pub: u8[] = fromHex(PUB)
  const base: u8[] = baseOf(inp.msg, 0)
  const msgs: u8[][] = []
  const sigs: u8[][] = []
  for (let j: i32 = 0; j < RING; j++) {
    const m: u8[] = copyOf(inp.msg)
    tweak(m, 0, base, j)
    msgs.push(m)
    sigs.push(fromHex(RING_SIGS.slice(192 * j, 192 * (j + 1))))
  }
  const last: i32 = a.size - 1
  msgs[TAMPERED][last] = msgs[TAMPERED][last] ^ toU8(1)
  // The byte folded for each verify: 1 when it answered true, 0 when false.
  const valid: u8[] = [toU8(1)]
  const invalid: u8[] = [toU8(0)]
  let sum: u32 = fold(foldStart(), pub)
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const j: i32 = i % RING
    if (j < 0 || j >= toI32(msgs.length) || j >= toI32(sigs.length)) {
      return 1
    }
    const ok: boolean = p384VerifySha384(pub, msgs[j], sigs[j])
    if (ok !== (j !== TAMPERED)) {
      writeError("p384: p384VerifySha384 gave the wrong answer\n")
      return 1
    }
    sum = fold(sum, ok ? valid : invalid)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("p384")
  if (a === null) {
    return 2
  }
  if (a.kernel !== "p384-verify") {
    writeError(`p384: no kernel ${a.kernel}\n`)
    return 2
  }
  if (a.size !== SIZE) {
    writeError("p384: the embedded signatures are for 64-byte messages; ring.mjs makes others\n")
    return 2
  }
  return verifyLoop(a)
}
