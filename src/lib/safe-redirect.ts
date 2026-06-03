// Evita open redirects (CWE-601): solo permitimos rutas internas relativas como
// destino post-login. Cualquier URL absoluta (`https://evil.com`) o
// protocolo-relativa (`//evil.com`) resolvería a un host externo, así que la
// descartamos y caemos al home. Compartido por el callback (server) y el login
// (cliente) para que ambos apliquen la misma regla.
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/"
  // Debe empezar con "/" pero no con "//" (protocolo-relativo) ni "/\" (que
  // algunos navegadores normalizan a "//").
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next
  }
  return "/"
}
