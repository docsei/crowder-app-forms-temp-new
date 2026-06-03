// Crowder Embedded App protocol — Bearer auth para webhooks server-to-server.
// Spec: https://crowder-docs.vercel.app/embedded-app/
import { createHmac, randomBytes, timingSafeEqual } from "crypto"

// Key aleatoria por proceso para el HMAC de comparación. No persiste ni se
// expone: solo deriva digests de longitud fija a partir de los secretos para
// que timingSafeEqual no filtre el largo y no comparemos hashes sin sal del
// secreto. Las API keys son de alta entropía (no passwords), así que no aplica
// un KDF lento tipo bcrypt/scrypt: ralentizaría cada webhook sin ganar nada.
const COMPARISON_KEY = randomBytes(32)

/**
 * Verifica un Bearer token contra una o más keys aceptadas. Compara digests
 * HMAC con timingSafeEqual y acumula resultados sin short-circuit para no
 * filtrar timing sobre cuál slot matcheó (relevante con doble-aceptación).
 */
export function verifyBearer(
  authorizationHeader: string | null,
  acceptedKeys: readonly (string | null)[],
): boolean {
  if (!authorizationHeader) return false
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  if (!match) return false

  const presented = digest(match[1])
  let matched = false
  for (const k of acceptedKeys) {
    if (k && timingSafeEqual(presented, digest(k))) matched = true
  }
  return matched
}

function digest(value: string): Buffer {
  return createHmac("sha256", COMPARISON_KEY).update(value).digest()
}
