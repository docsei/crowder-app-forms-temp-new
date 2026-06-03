import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components no permiten setear cookies — Middleware lo hace.
          }
        },
      },
    },
  )
}

export async function getCurrentUser() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Defensa en profundidad (CWE-862): el middleware ya redirige a /login sin
// sesión, pero cada server action revalida la sesión en su propio límite para
// no depender de una sola capa. Lanza si no hay usuario autenticado.
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("unauthorized")
  return user
}
