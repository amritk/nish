// The RSA material of `net_tls_rsa_server`, made once with OpenSSL 3.0:
// a 2048-bit key (`openssl genrsa 2048`) in its PKCS#1 and PKCS#8 PEM forms,
// a self-signed certificate for it (CN and SAN "localhost", sha256WithRSA),
// its RSAPublicKey, and a 1024-bit key the signer must refuse. Test keys
// only: nothing here guards anything.
import { fromHex } from "../crypto_x509/hex";

/** The 2048-bit key as PKCS#1, `-----BEGIN RSA PRIVATE KEY-----`. */
export const rsaKeyPkcs1 = (): string =>
  [
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIIEpAIBAAKCAQEAveDgrb3XY6IN4eGuyTPgkygMcO2Cw9wXtFggG9GPtNf8Lg0/",
    "gvVU3McnKRTM8odU/3wysrUbI8KOfeAa2ctPKdu7hyLIjFRSmyKe7mTWwxFDdcUF",
    "1Tv/lEHc9vlIpv5C37JLCHX6f+o5RRoBE35e5DZJxnybqHUFd758j7cIrNBpt4BF",
    "YeyI5UFu7HlclqsE2y4yTKAWE0ojw4NYnc2J1A775drGv15WajmtGQTY8TfQ579C",
    "IHCgm3z6tOofIuoGjvcgmKeEX+SpEur+SmB1no41ss9vaszFez+daDWToowZgkpR",
    "cXAPNb/WfO0i9hYcfQe01oE4qIqqUqlMEbuyqwIDAQABAoIBAAOnCcC4gCYt0y/f",
    "KX+RUeaYGfUqJx52uLYCuUtlB+tQpEyL0LGc39myCFzP8PP8CnSHrRSm9d4FkLwh",
    "zXfBuMTIsfNy2yy9NSxAHufdugvdOdD6zevret/H4eTrqAFzrqb4RQflTRZHfnvd",
    "I4bTzXt9AoT2QgBG5VNdBK8MXvcEBXzV017DTMJY3J3VjNSUSpmJtZjE+mmHcV76",
    "9fkPf19W3hIHZbgqsFdDfp0zHDl/jnwBLs1WL6srcEM/8pd4cKh+WVbfU6XHpqfS",
    "BfYLzdc0tGzQzesrcZWPAAA6CDSntqVQbf9oxujR5LR42LSyQIdSLThGPUVR6SaY",
    "GtJIytECgYEA5TLujxVrVLnn0z5R/lmS4xS1FfTXPbnk7Z+ztn6Ez+brCDpAlk1H",
    "J6lNlDHKGrOSA+rBJazs0uq5ax7IAcybdTr7CSoGsVvMaPf/06K/CLk+A1MTnnJu",
    "76kUkZz/DyBjrjXXbMBq7VI87PuvoOCOCEolryrTtpEHNy1GOjbEhb0CgYEA1BTi",
    "5bJxmNOztaq8SNKYOyAqfxJarZoisYTPTemlgfsJIab43qFj1sR5ukSyQ3b1AB1q",
    "Ypti1nxIe2klIAcJXQSVgkSpP11Q4qqNZNpx7j9dRJysxo0kJX2S1cyyB6+Gph1j",
    "vD8CftcHaIz5TyOv5u8M9mqrtIrARju9fFGinIcCgYB7gHBPpWkKZIpop6Ii/j1K",
    "I3RYenApEKws5us9oPsL1BA9hLYcx1NaKb5l5lZTAQPjHHIrTPznwhdbg2Cep5P1",
    "HWz7ySuGEkMZJNkzPvTVTIv/2potvNfOSDuPIxvFGNzdmKGWNjDn5HJz+ELw209t",
    "ZBbeRqOCMq/CqaC36Z8HuQKBgQCRKcKsqllq2+zz+etqhQtB3SB5XdzHWutISrmC",
    "gNySfXuglyNdb2ZhCJaxUngaCYBlFb1NxUH/wY3zOuL4axiTnKGhStH11y+YFlk1",
    "oPe+tYxnfD4eoVkOeEdbJALvk8s8RH2RyicxHompnGTBMJIkJZffyt/AcgBtklJ+",
    "l3oQXQKBgQCX2wcSkZF9x5nNgzQvSnhm8C06PybcrMI/Dm9h6YrFfV31AyoJcNZ8",
    "kz3hHgelVuobgN9j38xZhtQZGVS6j9JkQ4TxElLKjpYVi5gr+w9MC11ErAftjFyd",
    "4qyQvdTneCYOekTo6cwaLCzz1eMqJoShvXopNXVldvcPVN3Jl10W5Q==",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n");

/** The same key as PKCS#8, `-----BEGIN PRIVATE KEY-----`. */
export const rsaKeyPkcs8 = (): string =>
  [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC94OCtvddjog3h",
    "4a7JM+CTKAxw7YLD3Be0WCAb0Y+01/wuDT+C9VTcxycpFMzyh1T/fDKytRsjwo59",
    "4BrZy08p27uHIsiMVFKbIp7uZNbDEUN1xQXVO/+UQdz2+Uim/kLfsksIdfp/6jlF",
    "GgETfl7kNknGfJuodQV3vnyPtwis0Gm3gEVh7IjlQW7seVyWqwTbLjJMoBYTSiPD",
    "g1idzYnUDvvl2sa/XlZqOa0ZBNjxN9Dnv0IgcKCbfPq06h8i6gaO9yCYp4Rf5KkS",
    "6v5KYHWejjWyz29qzMV7P51oNZOijBmCSlFxcA81v9Z87SL2Fhx9B7TWgTioiqpS",
    "qUwRu7KrAgMBAAECggEAA6cJwLiAJi3TL98pf5FR5pgZ9SonHna4tgK5S2UH61Ck",
    "TIvQsZzf2bIIXM/w8/wKdIetFKb13gWQvCHNd8G4xMix83LbLL01LEAe5926C905",
    "0PrN6+t638fh5OuoAXOupvhFB+VNFkd+e90jhtPNe30ChPZCAEblU10Erwxe9wQF",
    "fNXTXsNMwljcndWM1JRKmYm1mMT6aYdxXvr1+Q9/X1beEgdluCqwV0N+nTMcOX+O",
    "fAEuzVYvqytwQz/yl3hwqH5ZVt9Tpcemp9IF9gvN1zS0bNDN6ytxlY8AADoINKe2",
    "pVBt/2jG6NHktHjYtLJAh1ItOEY9RVHpJpga0kjK0QKBgQDlMu6PFWtUuefTPlH+",
    "WZLjFLUV9Nc9ueTtn7O2foTP5usIOkCWTUcnqU2UMcoas5ID6sElrOzS6rlrHsgB",
    "zJt1OvsJKgaxW8xo9//Tor8IuT4DUxOecm7vqRSRnP8PIGOuNddswGrtUjzs+6+g",
    "4I4ISiWvKtO2kQc3LUY6NsSFvQKBgQDUFOLlsnGY07O1qrxI0pg7ICp/ElqtmiKx",
    "hM9N6aWB+wkhpvjeoWPWxHm6RLJDdvUAHWpim2LWfEh7aSUgBwldBJWCRKk/XVDi",
    "qo1k2nHuP11EnKzGjSQlfZLVzLIHr4amHWO8PwJ+1wdojPlPI6/m7wz2aqu0isBG",
    "O718UaKchwKBgHuAcE+laQpkiminoiL+PUojdFh6cCkQrCzm6z2g+wvUED2EthzH",
    "U1opvmXmVlMBA+MccitM/OfCF1uDYJ6nk/UdbPvJK4YSQxkk2TM+9NVMi//ami28",
    "185IO48jG8UY3N2YoZY2MOfkcnP4QvDbT21kFt5Go4Iyr8KpoLfpnwe5AoGBAJEp",
    "wqyqWWrb7PP562qFC0HdIHld3Mda60hKuYKA3JJ9e6CXI11vZmEIlrFSeBoJgGUV",
    "vU3FQf/BjfM64vhrGJOcoaFK0fXXL5gWWTWg9761jGd8Ph6hWQ54R1skAu+TyzxE",
    "fZHKJzEeiamcZMEwkiQll9/K38ByAG2SUn6XehBdAoGBAJfbBxKRkX3Hmc2DNC9K",
    "eGbwLTo/Jtyswj8Ob2HpisV9XfUDKglw1nyTPeEeB6VW6huA32PfzFmG1BkZVLqP",
    "0mRDhPESUsqOlhWLmCv7D0wLXUSsB+2MXJ3irJC91Od4Jg56ROjpzBosLPPV4yom",
    "hKG9eik1dWV29w9U3cmXXRbl",
    "-----END PRIVATE KEY-----",
  ].join("\n");

/** A 1024-bit PKCS#1 key: below `RSA_SIGN_MIN_BITS`, so refused. */
export const rsaKeySmall = (): string =>
  [
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIICXgIBAAKBgQDCZztKFsqeTTAUeA0QCmIRBO6BtNhpnFu3NHHB1AZoAN/Qgg41",
    "utR6OsP9iDvk3BICkrgsSJpNgiQ/WnDd8SgEZuNT7OSMZANZ1UPR159J7vevhmwt",
    "sqlN5/RtI9/7dJ2yY6US4fF23eEAOyLUxnrRdHDvmZP2caqB/YksmUE/mQIDAQAB",
    "AoGBAITd+W/R0/oN12amBoeIES6AqGKOL7s+2pCEj5tiRl6e+lmQChY+8yn3MC0A",
    "B6+LmeOYU7gwhwWihROnxKxsPmRSx0SxmyipZztwqNA4Ld2nhl+ULQT/5gDGQCa+",
    "n7RQnXmfdSYZss0w+MNvo6zD5ePHwfYCYQuuZt4stuq6fUgBAkEA5EMZssb+5uq4",
    "Pvi3ncZ19HQQAUxGoKMqeQ8RdqguPE0rN1pdWydT16VddZMWixVqF0BZAlqrrdQ3",
    "moG6QugNeQJBANoG1OasPU+mEZuSpy6/U8mo2KiUNryNMtzxz9GTgQtnppoUFa/6",
    "+YhTNBNLdE0fCeu4NrtN4NRIV4jP/Q0Z2yECQQCQgCn0kyUq6cxZkPosV0a0ygSX",
    "zcGoT6LDoFZd13ntkqyZDgureOoKyhSwKb1LrvLKZWHzq5KjKIVKunU/hceBAkBN",
    "pZk0/apoL1CeA0CfGWyRqRxgDUjhJbgzj7rffJS8pxFiVjzTC6LKtjcZmAm3XZJ+",
    "7IAxfK7Ra2IhS1Fn1QmBAkEAnj64bHrwF31y/l3qzAVRtssaCk4NZ275cSD66mq2",
    "VmQcNYdqC4sM+VpafZyPInlaw1VTiNaqu8TQBtZkUPhlBw==",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n");

/** The certificate for the 2048-bit key as PEM, the form `serve` writes for openssl and curl. */
export const rsaCertPem = (): string =>
  [
    "-----BEGIN CERTIFICATE-----",
    "MIIDITCCAgmgAwIBAgIUHvbqp8G//7AD8yL5SHAn+aXBP3owDQYJKoZIhvcNAQEL",
    "BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTEyNjAxMDMwM1oYDzIxMjYx",
    "MTAyMDEwMzAzWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEB",
    "AQUAA4IBDwAwggEKAoIBAQC94OCtvddjog3h4a7JM+CTKAxw7YLD3Be0WCAb0Y+0",
    "1/wuDT+C9VTcxycpFMzyh1T/fDKytRsjwo594BrZy08p27uHIsiMVFKbIp7uZNbD",
    "EUN1xQXVO/+UQdz2+Uim/kLfsksIdfp/6jlFGgETfl7kNknGfJuodQV3vnyPtwis",
    "0Gm3gEVh7IjlQW7seVyWqwTbLjJMoBYTSiPDg1idzYnUDvvl2sa/XlZqOa0ZBNjx",
    "N9Dnv0IgcKCbfPq06h8i6gaO9yCYp4Rf5KkS6v5KYHWejjWyz29qzMV7P51oNZOi",
    "jBmCSlFxcA81v9Z87SL2Fhx9B7TWgTioiqpSqUwRu7KrAgMBAAGjaTBnMB0GA1Ud",
    "DgQWBBSAN8b5F57XGHCIY7zuXt9546NQXzAfBgNVHSMEGDAWgBSAN8b5F57XGHCI",
    "Y7zuXt9546NQXzAPBgNVHRMBAf8EBTADAQH/MBQGA1UdEQQNMAuCCWxvY2FsaG9z",
    "dDANBgkqhkiG9w0BAQsFAAOCAQEAs8Bq5aky5D1IrN9Vf/wLZOVJlqMLuROyIPrR",
    "5Jm5K4zVwiUVxnV8z7Lv29gvoNz//0CrwY77YXQ2+JftYKScQVMcI6XGqfqxAbVC",
    "GVejveG/bC/6FsJaL3/Negp2h1iN7EDL9LF94IhLub4iRpuXZ3Gdtj15hBXYKDmm",
    "RTUSQ2fSRuUUjgOuLTeDDeSS08qS6yePf26cE7oY8k7/1MPKXvXT/Y69jnBKIn9x",
    "7w6F254To9TyUwxqbLkDy8rlga5kvCYR2YDSbKmW86cYF9cdFI9lhsMt9Nc4LwMo",
    "gaGkwZx4Y9w4pMHlQLKTjedrgwp+uuLIIlLwVzMn3lpsX71ZAw==",
    "-----END CERTIFICATE-----",
  ].join("\n");

/** The certificate's DER. */
export const rsaCertificate = (): u8[] =>
  fromHex(
    [
    "3082032130820209a00302010202141ef6eaa7c1bfffb003f322f9487027f9a5c13f7a300d06092a864886f70d01010b050030143112301006035504",
    "030c096c6f63616c686f73743020170d3236313132363031303330335a180f32313236313130323031303330335a30143112301006035504030c096c",
    "6f63616c686f737430820122300d06092a864886f70d01010105000382010f003082010a0282010100bde0e0adbdd763a20de1e1aec933e093280c70",
    "ed82c3dc17b458201bd18fb4d7fc2e0d3f82f554dcc7272914ccf28754ff7c32b2b51b23c28e7de01ad9cb4f29dbbb8722c88c54529b229eee64d6c3",
    "114375c505d53bff9441dcf6f948a6fe42dfb24b0875fa7fea39451a01137e5ee43649c67c9ba8750577be7c8fb708acd069b7804561ec88e5416eec",
    "795c96ab04db2e324ca016134a23c383589dcd89d40efbe5dac6bf5e566a39ad1904d8f137d0e7bf422070a09b7cfab4ea1f22ea068ef72098a7845f",
    "e4a912eafe4a60759e8e35b2cf6f6accc57b3f9d683593a28c19824a5171700f35bfd67ced22f6161c7d07b4d68138a88aaa52a94c11bbb2ab020301",
    "0001a3693067301d0603551d0e041604148037c6f9179ed718708863bcee5edf79e3a3505f301f0603551d230418301680148037c6f9179ed7187088",
    "63bcee5edf79e3a3505f300f0603551d130101ff040530030101ff30140603551d11040d300b82096c6f63616c686f7374300d06092a864886f70d01",
    "010b05000382010100b3c06ae5a932e43d48acdf557ffc0b64e54996a30bb913b220fad1e499b92b8cd5c22515c6757ccfb2efdbd82fa0dcffff40ab",
    "c18efb617436f897ed60a49c41531c23a5c6a9fab101b5421957a3bde1bf6c2ffa16c25a2f7fcd7a0a7687588dec40cbf4b17de0884bb9be22469b97",
    "67719db63d798415d82839a64535124367d246e5148e03ae2d37830de492d3ca92eb278f7f6e9c13ba18f24effd4c3ca5ef5d3fd8ebd8e704a227f71",
    "ef0e85db9e13a3d4f2530c6a6cb903cbcae581ae64bc2611d980d26ca996f3a71817d71d148f6586c32df4d7382f032881a1a4c19c7863dc38a4c1e5",
    "40b2938de76b830a7ebae2c82252f0573327de5a6c5fbd5903",
  ].join("")
  );

/** The key's RSAPublicKey DER, as `x509PublicKey` reads it out of the certificate. */
export const rsaPublicKey = (): u8[] =>
  fromHex(
    [
    "3082010a0282010100bde0e0adbdd763a20de1e1aec933e093280c70ed82c3dc17b458201bd18fb4d7fc2e0d3f82f554dcc7272914ccf28754ff7c32",
    "b2b51b23c28e7de01ad9cb4f29dbbb8722c88c54529b229eee64d6c3114375c505d53bff9441dcf6f948a6fe42dfb24b0875fa7fea39451a01137e5e",
    "e43649c67c9ba8750577be7c8fb708acd069b7804561ec88e5416eec795c96ab04db2e324ca016134a23c383589dcd89d40efbe5dac6bf5e566a39ad",
    "1904d8f137d0e7bf422070a09b7cfab4ea1f22ea068ef72098a7845fe4a912eafe4a60759e8e35b2cf6f6accc57b3f9d683593a28c19824a5171700f",
    "35bfd67ced22f6161c7d07b4d68138a88aaa52a94c11bbb2ab0203010001",
  ].join("")
  );
