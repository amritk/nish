// The crypto twins' shared input generator and checksum fold, for Go: the
// same bytes and the same fold as lib/gen.ts, under the contract in
// bench/crypto/README.md. The runner copies this file into the build
// directory beside a family's go/ sources, so it is package main.
package main

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// foldStart is FNV-1a 32's offset basis: the fold's start.
const foldStart uint32 = 2166136261

// fold is FNV-1a 32 over bytes, from sum.
func fold(sum uint32, bytes []byte) uint32 {
	for _, b := range bytes {
		sum = (sum ^ uint32(b)) * 16777619
	}
	return sum
}

// genInputs is one kernel's inputs, every buffer drawn from one stream in this order.
type genInputs struct {
	key, nonce, aad, msg []byte
}

// inputs draws the key, nonce, AAD and message of kernel at size, at the lengths given.
func inputs(kernel string, size, keyLen, nonceLen, aadLen, msgLen int) genInputs {
	x := fold(foldStart, []byte(fmt.Sprintf("%s:%d", kernel, size)))
	if x == 0 {
		x = 1
	}
	draw := func(length int) []byte {
		out := make([]byte, length)
		for i := range out {
			x ^= x << 13
			x ^= x >> 17
			x ^= x << 5
			out[i] = byte(x)
		}
		return out
	}
	key := draw(keyLen)
	nonce := draw(nonceLen)
	aad := draw(aadLen)
	return genInputs{key, nonce, aad, draw(msgLen)}
}

// tweak sets iteration i's input: bytes[at:at+4] to base (the original four bytes) XOR i, little-endian.
func tweak(bytes []byte, at int, base [4]byte, i uint32) {
	bytes[at] = base[0] ^ byte(i)
	bytes[at+1] = base[1] ^ byte(i>>8)
	bytes[at+2] = base[2] ^ byte(i>>16)
	bytes[at+3] = base[3] ^ byte(i>>24)
}

// parseArgs reads `<kernel> <size> <iterations>`, or exits 2 with a usage line.
func parseArgs(program string) (string, int, int) {
	if len(os.Args) == 4 {
		size, e1 := strconv.Atoi(os.Args[2])
		iterations, e2 := strconv.Atoi(os.Args[3])
		if e1 == nil && e2 == nil && size >= 0 && iterations >= 1 {
			return os.Args[1], size, iterations
		}
	}
	fmt.Fprintf(os.Stderr, "usage: %s <kernel> <size> <iterations>\n", program)
	os.Exit(2)
	return "", 0, 0
}

// report prints the contract's two lines: the checksum on stdout, the timed loop's nanoseconds on stderr.
func report(sum uint32, started time.Time) {
	ns := time.Since(started).Nanoseconds()
	fmt.Printf("checksum %08x\n", sum)
	fmt.Fprintf(os.Stderr, "ns %d\n", ns)
}
