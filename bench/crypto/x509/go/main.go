// The x509 family's Go twin: crypto/x509's CreateCertificate and
// ParseCertificate, under the contract in bench/crypto/README.md and the
// inputs in this family's README.md. The runner builds it with lib/gen.go
// beside it; `-tags purego` is the portable column.
package main

import (
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"
	"time"
)

// The subject's and issuer's common name.
const commonName = "bench.nish.dev"

// notBefore: 2026-01-01T00:00:00Z, in milliseconds.
const notBeforeMs = 1767225600000

// The validity, in days.
const days = 14

// The certificate x509-parse reads: Nish's x509-mint output for its first
// iteration, so every twin parses the same bytes.
const fixedCert = "3082014e3081f6a003020102021057a8a60ac6cf332f0d105dba046fb40d300a06082a8648ce3d04030230193117301506035504030c0e62656e63682e6e6973682e646576301e170d3236303130313030303030305a170d3236303131353030303030305a30193117301506035504030c0e62656e63682e6e6973682e6465763059301306072a8648ce3d020106082a8648ce3d030107034200046773f52bac85b0278dbc1c6ab010e6a63ab5cb19673672f3a66e3b53e5fc31fa6881cfb754e458be32e5c105f96ac0dc83f02224f7c4f0f56ec4f165496b0e53a320301e300c0603551d130101ff04023000300e0603551d0f0101ff040403020780300a06082a8648ce3d04030203470030440220706060f8d5a0c763dafd8f5a9a7cfd6131b7eba82739420235dcd9f91b2371f102207d9f5543446e841cc9029d83741fd9ed9753120cd1eefa51f098e6f60dc74742"

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

// The Name every twin writes: one RDN whose common name is a UTF8String.
// pkix.Name would write a PrintableString.
func subjectName() []byte {
	cn := asn1.RawValue{Tag: asn1.TagUTF8String, Bytes: []byte(commonName)}
	name, err := asn1.Marshal(pkix.RDNSequence{{{Type: asn1.ObjectIdentifier{2, 5, 4, 3}, Value: cn}}})
	if err != nil {
		fail("asn1.Marshal", err)
	}
	return name
}

// Seconds since 1970 as eight big-endian bytes.
func seconds(t time.Time) []byte {
	return binary.BigEndian.AppendUint64(nil, uint64(t.Unix()))
}

// What both kernels fold for a certificate: the common name, the validity,
// the point and whether its self-signature verifies.
func foldCertificate(sum uint32, cert *x509.Certificate) uint32 {
	pub, ok := cert.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		fail("reading the public key", nil)
	}
	point, err := pub.ECDH()
	if err != nil {
		fail("ecdsa.PublicKey.ECDH", err)
	}
	// CheckSignatureFrom would refuse a parent that is not a CA, so the
	// signature alone is checked, as the other twins check it.
	verdict := []byte{0}
	if cert.CheckSignature(cert.SignatureAlgorithm, cert.RawTBSCertificate, cert.Signature) == nil {
		verdict[0] = 1
	}
	sum = fold(sum, []byte(cert.Subject.CommonName))
	sum = fold(fold(sum, seconds(cert.NotBefore)), seconds(cert.NotAfter))
	return fold(fold(sum, point.Bytes()), verdict)
}

func main() {
	kernel, size, iterations := parseArgs("go")
	sum := foldStart
	switch kernel {
	case "x509-mint":
		if size < 4 || size > 20 {
			fmt.Fprintln(os.Stderr, "go: x509-mint's size is the serial's length, 4 to 20 bytes")
			os.Exit(2)
		}
		inp := inputs(kernel, size, 32, 0, 0, size)
		msg := inp.msg
		var base [4]byte
		copy(base[:], msg)
		key := p256Key(inp.key)
		name := subjectName()
		notBefore := time.UnixMilli(notBeforeMs).UTC()
		certs := make([][]byte, iterations)
		started := time.Now()
		for i := 0; i < iterations; i++ {
			tweak(msg, 0, base, uint32(i))
			serial := append([]byte(nil), msg...)
			// A positive INTEGER whose first octet is not zero, so it is encoded as it is.
			serial[0] = serial[0]&0x3f | 0x40
			template := &x509.Certificate{
				SerialNumber:          new(big.Int).SetBytes(serial),
				RawSubject:            name,
				NotBefore:             notBefore,
				NotAfter:              notBefore.AddDate(0, 0, days),
				KeyUsage:              x509.KeyUsageDigitalSignature,
				BasicConstraintsValid: true,
			}
			der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
			if err != nil {
				fail("x509.CreateCertificate", err)
			}
			certs[i] = der
		}
		// ECDSA's signatures are randomised, so what is folded is what parsing
		// each certificate back gives, after the clock stops.
		stopped := time.Now()
		for _, der := range certs {
			cert, err := x509.ParseCertificate(der)
			if err != nil {
				fail("x509.ParseCertificate", err)
			}
			sum = foldCertificate(fold(sum, cert.SerialNumber.Bytes()), cert)
		}
		report(sum, started.Add(time.Since(stopped)))

	case "x509-parse":
		der, err := hex.DecodeString(fixedCert)
		if err != nil {
			fail("hex.DecodeString", err)
		}
		if size != len(der) {
			fmt.Fprintf(os.Stderr, "go: x509-parse's size is %d, the fixed certificate's length\n", len(der))
			os.Exit(2)
		}
		started := time.Now()
		for i := 0; i < iterations; i++ {
			cert, err := x509.ParseCertificate(der)
			if err != nil {
				fail("x509.ParseCertificate", err)
			}
			sum = foldCertificate(sum, cert)
		}
		report(sum, started)

	default:
		fmt.Fprintf(os.Stderr, "go: no kernel %s\n", kernel)
		os.Exit(2)
	}
}
