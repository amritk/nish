// Go's crypto/rsa for tests/link/crypto_rsa_sign_interop/generate.mjs: one
// JSON request on stdin, one JSON answer on stdout. It generates keys, signs
// RSASSA-PSS-SHA256 under a salt it is given (crypto/rsa reads the salt from
// the reader it is handed, so a reader over the salt's bytes fixes it), and
// verifies a signature at a given salt length. Every byte string is hex.
//
//	go run interop.go < request.json
package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
)

type request struct {
	Keygen []int  `json:"keygen"`
	Sign   []item `json:"sign"`
	Verify []item `json:"verify"`
}

type item struct {
	Pkcs1   string `json:"pkcs1"`
	Msg     string `json:"msg"`
	Salt    string `json:"salt"`
	SaltLen int    `json:"saltLen"`
	Sig     string `json:"sig"`
}

type key struct {
	Bits  int    `json:"bits"`
	Pkcs1 string `json:"pkcs1"`
	Pkcs8 string `json:"pkcs8"`
}

type answer struct {
	Keys     []key    `json:"keys"`
	Sigs     []string `json:"sigs"`
	Verified []bool   `json:"verified"`
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func unhex(s string) []byte {
	b, err := hex.DecodeString(s)
	must(err)
	return b
}

func main() {
	var req request
	must(json.NewDecoder(os.Stdin).Decode(&req))
	var out answer
	for _, bits := range req.Keygen {
		k, err := rsa.GenerateKey(rand.Reader, bits)
		must(err)
		p8, err := x509.MarshalPKCS8PrivateKey(k)
		must(err)
		out.Keys = append(out.Keys, key{
			Bits:  k.N.BitLen(),
			Pkcs1: hex.EncodeToString(x509.MarshalPKCS1PrivateKey(k)),
			Pkcs8: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: p8})),
		})
	}
	for _, it := range req.Sign {
		k, err := x509.ParsePKCS1PrivateKey(unhex(it.Pkcs1))
		must(err)
		salt := unhex(it.Salt)
		h := sha256.Sum256(unhex(it.Msg))
		sig, err := rsa.SignPSS(bytes.NewReader(salt), k, crypto.SHA256, h[:], &rsa.PSSOptions{SaltLength: len(salt)})
		must(err)
		out.Sigs = append(out.Sigs, hex.EncodeToString(sig))
	}
	for _, it := range req.Verify {
		k, err := x509.ParsePKCS1PrivateKey(unhex(it.Pkcs1))
		must(err)
		h := sha256.Sum256(unhex(it.Msg))
		err = rsa.VerifyPSS(&k.PublicKey, crypto.SHA256, h[:], unhex(it.Sig), &rsa.PSSOptions{SaltLength: it.SaltLen})
		out.Verified = append(out.Verified, err == nil)
	}
	must(json.NewEncoder(os.Stdout).Encode(out))
}
