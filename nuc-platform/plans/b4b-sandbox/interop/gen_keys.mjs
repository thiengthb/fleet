// Generate a throwaway RSA keypair (PEM) for the interop test. Node side stands in for "provision the keypair".
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
writeFileSync(process.argv[2], privateKey);
writeFileSync(process.argv[3], publicKey);
console.log('keys written');
