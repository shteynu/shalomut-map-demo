/**
 * The root certificate the deployed database's chain ends at.
 *
 * Supabase terminates TLS with its own certificate authority rather than one in
 * a public trust store, and until 2026-08-22 this project answered that with
 * `rejectUnauthorized: false` — every connection to the deployed database, from
 * the serverless runtime and from every administrative script, encrypted
 * without ever checking who it was talking to. An active attacker between the
 * function and the pooler could present any certificate at all and read or
 * rewrite every survey answer, and take the database credentials on the way
 * past. Encryption without verification is a conversation with whoever answers.
 *
 * ## Provenance, and why it is not trust-on-first-use
 *
 * Downloaded over verified HTTPS from
 * `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`
 * on 2026-08-22, so the public PKI vouches for where it came from. It was then
 * cross-checked against the chain the pooler itself presents: the root the
 * server sends has the same SHA-256 fingerprint as the file that was
 * downloaded. Neither check alone would be enough — a certificate taken from
 * the server you are trying to authenticate proves nothing, and a file from a
 * download page could in principle be the wrong file — and together they leave
 * nothing for a single compromised party to lie about.
 *
 *   subject     C=US, ST=Delware, L=New Castle, O=Supabase Inc,
 *               CN=Supabase Root 2021 CA   (self-signed)
 *   valid       2021-04-28 .. 2031-04-26
 *   SHA-256     80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
 *               82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 *
 * ("Delware" is the certificate's own spelling. It is reproduced rather than
 * corrected, because this comment describes a fixed artefact.)
 *
 * ## Why it is inline rather than a file
 *
 * The runtime is serverless. A `.crt` beside this module would have to survive
 * whatever the build's file tracing decided about it, and the failure mode of
 * getting that wrong is a deployment that cannot reach its database at all.
 * A certificate is public information — it is what the server hands to every
 * client that connects — so there is nothing here that a repository should not
 * hold.
 *
 * `DATABASE_CA_CERT` overrides it for the day the authority rotates before this
 * file does. There is deliberately no way to switch verification off.
 */
export const SUPABASE_ROOT_CA_2021 = `
-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;
