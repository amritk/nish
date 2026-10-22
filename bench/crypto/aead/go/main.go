// The AEAD family's Go twin: crypto/aes with crypto/cipher's GCM, and
// golang.org/x/crypto/chacha20poly1305, under the contract in
// bench/crypto/README.md and the inputs in this family's README.md. The runner
// builds it with lib/gen.go beside it; `-tags purego` is the portable column.
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"fmt"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/chacha20poly1305"
)

const (
	nonceLen   = 12
	nonceTweak = 8
	aadLen     = 13
	ring       = 16
)

func fail(what string, err error) {
	fmt.Fprintf(os.Stderr, "go: %s: %v\n", what, err)
	os.Exit(1)
}

func main() {
	kernel, size, iterations := parseArgs("go")
	cipherName, op, _ := strings.Cut(kernel, "-")
	keyLen := map[string]int{"aes128gcm": 16, "aes256gcm": 32, "chacha20poly1305": 32}[cipherName]
	if keyLen == 0 || (op != "seal" && op != "open") {
		fmt.Fprintf(os.Stderr, "go: no kernel %s\n", kernel)
		os.Exit(2)
	}
	if size < 4 {
		fmt.Fprintln(os.Stderr, "go: the size is at least 4 bytes")
		os.Exit(2)
	}
	inp := inputs(kernel, size, keyLen, nonceLen, aadLen, size)
	// Keyed once, before the clock.
	var aead cipher.AEAD
	var err error
	if cipherName == "chacha20poly1305" {
		aead, err = chacha20poly1305.New(inp.key)
	} else {
		var block cipher.Block
		if block, err = aes.NewCipher(inp.key); err == nil {
			aead, err = cipher.NewGCM(block)
		}
	}
	if err != nil {
		fail("keying the cipher", err)
	}
	msg, nonce := inp.msg, inp.nonce
	var msgBase, nonceBase [4]byte
	copy(msgBase[:], msg)
	copy(nonceBase[:], nonce[nonceTweak:])
	// Every iteration writes into the same buffer, as the C twin does.
	out := make([]byte, 0, size+aead.Overhead())
	sum := foldStart
	if op == "seal" {
		started := time.Now()
		for i := 0; i < iterations; i++ {
			tweak(msg, 0, msgBase, uint32(i))
			tweak(nonce, nonceTweak, nonceBase, uint32(i))
			sum = fold(sum, aead.Seal(out[:0], nonce, msg, inp.aad))
		}
		report(sum, started)
		return
	}
	// The ring: entry r is the seal of the message and nonce tweaked with r.
	sealed := make([][]byte, ring)
	for r := range sealed {
		tweak(msg, 0, msgBase, uint32(r))
		tweak(nonce, nonceTweak, nonceBase, uint32(r))
		sealed[r] = aead.Seal(nil, nonce, msg, inp.aad)
	}
	started := time.Now()
	for i := 0; i < iterations; i++ {
		r := i % ring
		tweak(nonce, nonceTweak, nonceBase, uint32(r))
		opened, err := aead.Open(out[:0], nonce, sealed[r], inp.aad)
		if err != nil {
			fail("open", err)
		}
		sum = fold(sum, opened)
	}
	report(sum, started)
}
