// The curves family's Go twin: crypto/ecdh, crypto/ecdsa and crypto/ed25519,
// under the contract in bench/crypto/README.md and the inputs in this family's
// README.md. The runner builds it with lib/gen.go beside it; `-tags purego` is
// the portable column.
package main

import (
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"fmt"
	"os"
	"time"
)

// Messages the verify kernels cycle through, signed before the clock starts.
const ring = 16

// The ring entry changed after it was signed, so its verify must answer false.
const tampered = 1

func fail(what string, err error) {
	fmt.Fprintf(os.Stderr, "go: %s: %v\n", what, err)
	os.Exit(1)
}

// The P-256 key whose private scalar is d, from a SEC1 ECPrivateKey naming
// prime256v1: Go 1.24 has no other way to take a raw ECDSA scalar.
func p256Key(d []byte) *ecdsa.PrivateKey {
	der := append([]byte{0x30, 0x31, 0x02, 0x01, 0x01, 0x04, 0x20}, d...)
	der = append(der, 0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07)
	key, err := x509.ParseECPrivateKey(der)
	if err != nil {
		fail("x509.ParseECPrivateKey", err)
	}
	return key
}

// The 65-byte uncompressed point of key's public key.
func p256Public(key *ecdsa.PrivateKey) []byte {
	pub, err := key.PublicKey.ECDH()
	if err != nil {
		fail("ecdsa.PublicKey.ECDH", err)
	}
	return pub.Bytes()
}

// One byte for a verify's answer: 1 for true, 0 for false.
func verdict(ok bool) []byte {
	if ok {
		return []byte{1}
	}
	return []byte{0}
}

func main() {
	kernel, size, iterations := parseArgs("go")
	switch kernel {
	case "x25519-base", "x25519":
		if size != 32 {
			fmt.Fprintln(os.Stderr, "go: an X25519 kernel's size is 32")
			os.Exit(2)
		}
	case "p256-sign", "p256-verify", "ed25519-sign", "ed25519-verify":
	default:
		fmt.Fprintf(os.Stderr, "go: no kernel %s\n", kernel)
		os.Exit(2)
	}
	keyLen := 32
	if kernel == "x25519-base" {
		keyLen = 0
	}
	inp := inputs(kernel, size, keyLen, 0, 0, size)
	msg := inp.msg
	var base [4]byte
	copy(base[:], msg)
	sum := foldStart
	curve := ecdh.X25519()

	switch kernel {
	case "x25519-base":
		started := time.Now()
		for i := 0; i < iterations; i++ {
			tweak(msg, 0, base, uint32(i))
			// NewPrivateKey computes the public key, X25519 of the base point.
			key, err := curve.NewPrivateKey(msg)
			if err != nil {
				fail("X25519", err)
			}
			sum = fold(sum, key.PublicKey().Bytes())
		}
		report(sum, started)

	case "x25519":
		key, err := curve.NewPrivateKey(inp.key)
		if err != nil {
			fail("X25519", err)
		}
		u := msg
		started := time.Now()
		for i := 0; i < iterations; i++ {
			peer, err := curve.NewPublicKey(u)
			if err == nil {
				u, err = key.ECDH(peer)
			}
			if err != nil {
				fail("X25519", err)
			}
			sum = fold(sum, u)
		}
		report(sum, started)

	case "p256-sign":
		key := p256Key(inp.key)
		sum = fold(sum, p256Public(key))
		digests := make([][32]byte, iterations)
		sigs := make([][]byte, iterations)
		started := time.Now()
		for i := 0; i < iterations; i++ {
			tweak(msg, 0, base, uint32(i))
			digests[i] = sha256.Sum256(msg)
			sig, err := ecdsa.SignASN1(rand.Reader, key, digests[i][:])
			if err != nil {
				fail("ecdsa.SignASN1", err)
			}
			sigs[i] = sig
		}
		// ECDSA's signatures are randomised, so what is folded is each digest
		// and whether its signature verifies, checked after the clock stops.
		stopped := time.Now()
		for i := 0; i < iterations; i++ {
			sum = fold(fold(sum, digests[i][:]), verdict(ecdsa.VerifyASN1(&key.PublicKey, digests[i][:], sigs[i])))
		}
		report(sum, started.Add(time.Since(stopped)))

	case "ed25519-sign":
		key := ed25519.NewKeyFromSeed(inp.key)
		sum = fold(sum, key.Public().(ed25519.PublicKey))
		started := time.Now()
		for i := 0; i < iterations; i++ {
			tweak(msg, 0, base, uint32(i))
			sum = fold(sum, ed25519.Sign(key, msg))
		}
		report(sum, started)

	default:
		ec := kernel == "p256-verify"
		var verify func(m, sig []byte) bool
		var sign func(m []byte) []byte
		if ec {
			key := p256Key(inp.key)
			sum = fold(sum, p256Public(key))
			sign = func(m []byte) []byte {
				d := sha256.Sum256(m)
				sig, err := ecdsa.SignASN1(rand.Reader, key, d[:])
				if err != nil {
					fail("ecdsa.SignASN1", err)
				}
				return sig
			}
			verify = func(m, sig []byte) bool {
				d := sha256.Sum256(m)
				return ecdsa.VerifyASN1(&key.PublicKey, d[:], sig)
			}
		} else {
			key := ed25519.NewKeyFromSeed(inp.key)
			pub := key.Public().(ed25519.PublicKey)
			sum = fold(sum, pub)
			sign = func(m []byte) []byte { return ed25519.Sign(key, m) }
			verify = func(m, sig []byte) bool { return ed25519.Verify(pub, m, sig) }
		}
		var msgs, sigs [ring][]byte
		for j := range ring {
			msgs[j] = append([]byte(nil), msg...)
			tweak(msgs[j], 0, base, uint32(j))
			sigs[j] = sign(msgs[j])
		}
		msgs[tampered][size-1] ^= 1
		started := time.Now()
		for i := 0; i < iterations; i++ {
			j := i % ring
			ok := verify(msgs[j], sigs[j])
			if ok != (j != tampered) {
				fmt.Fprintf(os.Stderr, "go: %s gave the wrong answer\n", kernel)
				os.Exit(1)
			}
			sum = fold(sum, verdict(ok))
		}
		report(sum, started)
	}
}
