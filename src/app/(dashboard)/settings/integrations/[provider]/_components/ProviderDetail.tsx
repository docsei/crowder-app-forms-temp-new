"use client"

import { RiAddLine, RiMore2Line } from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { Switch } from "@/components/Switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import type { Provider } from "@/lib/db/schema"
import { formatDateTime } from "@/lib/formatters"
import type { VerifyResult } from "@/modules/integrations"

import {
  createCredential,
  deleteCredential,
  renameCredential,
  rotateSecret,
  setCredentialActive,
  setProviderEnabled,
  verifyCredential,
  verifyDraft,
} from "../../actions"
import {
  PROVIDER_FIELDS,
  type CredentialView,
  type ProviderMeta,
} from "../../provider-fields"

// Vuelca el resultado de una verificación en los setters locales de
// mensaje/error (los nombres de setter difieren entre ConnectForm y
// CredentialPanel, así que se pasan como argumentos).
function applyVerifyResult(
  res: VerifyResult,
  setMsg: (m: string | null) => void,
  setErr: (e: string | null) => void,
): void {
  if (res.ok) setMsg(`Conecta ✓ ${res.shopName ?? ""}`.trim())
  else setErr(res.error)
}

export function ProviderDetail({
  provider,
  credentials,
}: {
  provider: Provider
  credentials: CredentialView[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Drawer activo: "connect" (nueva conexión) o el id de una credencial a gestionar.
  const [drawer, setDrawer] = useState<"connect" | string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const meta = PROVIDER_FIELDS[provider]
  const selected =
    drawer && drawer !== "connect"
      ? credentials.find((c) => c.id === drawer) ?? null
      : null

  function removeIntegration() {
    if (!confirm(`¿Quitar la integración ${meta.label}? Las conexiones guardadas no se borran.`))
      return
    startTransition(async () => {
      setErr(null)
      const res = await setProviderEnabled(provider, false)
      if (res.ok) router.push("/settings/integrations")
      else setErr(res.error)
    })
  }

  return (
    <div>
      <Link
        href="/settings/integrations"
        className="text-xs text-muted-foreground transition hover:text-foreground"
      >
        ← Integraciones
      </Link>

      <div className="mb-8 mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {meta.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setDrawer("connect")}>
            <RiAddLine className="size-4" aria-hidden="true" /> Agregar conexión
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" aria-label="Opciones de la integración">
                <RiMore2Line className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={pending}
                onSelect={removeIntegration}
                className="text-red-600 dark:text-red-500"
              >
                Quitar integración
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      {credentials.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 bg-background py-12 text-center">
          <p className="text-sm font-medium text-foreground">Sin conexiones</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Aún no conectaste ninguna credencial para {meta.label}. Verificamos
            la credencial contra la API del proveedor antes de guardarla.
          </p>
          <Button variant="secondary" onClick={() => setDrawer("connect")}>
            Agregar conexión
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-background p-0">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Último sync</TableHeaderCell>
                  <TableHeaderCell>Creada</TableHeaderCell>
                  <TableHeaderCell className="text-right">Gestionar</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credentials.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">
                      {c.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.active ? "success" : "neutral"}>
                        {c.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setDrawer(c.id)}
                        className="text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        Gestionar
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRoot>
        </Card>
      )}

      <Drawer
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {selected ? selected.name : `Nueva conexión · ${meta.label}`}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-6">
            {selected ? (
              <CredentialPanel
                credential={selected}
                meta={meta}
                pending={pending}
                startTransition={startTransition}
                onDeleted={() => setDrawer(null)}
              />
            ) : drawer === "connect" ? (
              <ConnectForm
                provider={provider}
                meta={meta}
                pending={pending}
                onConnect={(input, onResult) =>
                  startTransition(async () => {
                    const res = await createCredential(input)
                    onResult(res)
                    if (res.ok) setDrawer(res.value)
                  })
                }
              />
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// ─── Conectar una credencial nueva (sección 6.2) ─────────────────────────────

function ConnectForm({
  provider,
  meta,
  pending,
  onConnect,
}: {
  provider: Provider
  meta: ProviderMeta
  pending: boolean
  onConnect: (
    input: { provider: Provider; name: string; config: Record<string, string>; secret: string },
    onResult: (res: { ok: boolean; error?: string }) => void,
  ) => void
}) {
  const [name, setName] = useState("")
  const [config, setConfig] = useState<Record<string, string>>({})
  const [secret, setSecret] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)
  const [verifying, startVerify] = useTransition()

  const ready = name.trim() && secret.trim() && meta.fields.every((f) => config[f.key]?.trim())

  return (
    <section className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Verificamos la credencial contra la API del proveedor antes de guardarla.
      </p>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tienda principal"
          />
        </div>
        {meta.fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <Input
              value={config[f.key] ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label>{meta.secretLabel}</Label>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {verifyMsg && <p className="text-sm text-emerald-600">{verifyMsg}</p>}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={verifying || !ready}
          onClick={() =>
            startVerify(async () => {
              setError(null)
              setVerifyMsg(null)
              const res = await verifyDraft({ provider, config, secret })
              applyVerifyResult(res, setVerifyMsg, setError)
            })
          }
        >
          Verificar
        </Button>
        <Button
          disabled={pending || !ready}
          onClick={() => {
            setError(null)
            setVerifyMsg(null)
            onConnect({ provider, name, config, secret }, (res) => {
              if (!res.ok) setError(res.error ?? "No se pudo conectar")
            })
          }}
        >
          Conectar
        </Button>
      </div>
    </section>
  )
}

// ─── Gestión de una credencial: activar / renombrar / rotar / eliminar ───────

function CredentialPanel({
  credential: c,
  meta,
  pending,
  startTransition,
  onDeleted,
}: {
  credential: CredentialView
  meta: ProviderMeta
  pending: boolean
  startTransition: (cb: () => void) => void
  onDeleted: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState("")
  const [newSecret, setNewSecret] = useState("")
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Creada el {formatDateTime(c.createdAt)}
      </p>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {verifyMsg && <p className="text-sm text-emerald-600">{verifyMsg}</p>}

      {/* Activación (sección 6.1) — toggle sin tocar el secreto */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Activación
        </h4>
        <div className="flex items-center gap-2">
          <Switch
            checked={c.active}
            disabled={pending}
            onCheckedChange={(active) =>
              startTransition(async () => {
                const res = await setCredentialActive(c.id, active)
                if (!res.ok) setErr(res.error)
              })
            }
          />
          <Label className="text-sm text-foreground">
            {c.active ? "Conexión activa" : "Conexión desactivada"}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Apagar detiene los syncs sin borrar el secreto guardado.
        </p>
      </section>

      {/* Nombre */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Nombre
        </h4>
        {editingName ? (
          <div className="flex gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            <Button
              variant="secondary"
              disabled={pending || !editName.trim()}
              onClick={() =>
                startTransition(async () => {
                  const res = await renameCredential(c.id, editName)
                  if (res.ok) setEditingName(false)
                  else setErr(res.error)
                })
              }
            >
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => setEditingName(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{c.name}</span>
            <button
              type="button"
              className="text-xs text-muted-foreground transition hover:text-foreground"
              onClick={() => {
                setEditingName(true)
                setEditName(c.name)
              }}
            >
              Renombrar
            </button>
          </div>
        )}
      </section>

      {/* Config (no-secreto) */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Configuración
        </h4>
        <dl className="space-y-1 text-sm">
          {meta.fields.map((f) => (
            <div key={f.key} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-mono text-foreground">{String(c.config[f.key] ?? "—")}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Secreto: solo reemplazar (rotación del tercero, sección 6.2) */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Secreto
        </h4>
        <p className="font-mono text-sm text-foreground">{c.secretPreview}</p>
        <p className="text-xs text-muted-foreground">
          No lo emitimos nosotros: si el proveedor lo rotó, reemplazá el token (no
          cambia la activación).
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            placeholder="Nuevo token"
          />
          <Button
            variant="secondary"
            disabled={pending || !newSecret.trim()}
            onClick={() =>
              startTransition(async () => {
                const res = await rotateSecret(c.id, newSecret)
                if (res.ok) setNewSecret("")
                else setErr(res.error)
              })
            }
          >
            Reemplazar
          </Button>
        </div>
      </section>

      {/* Acciones: verificar / eliminar */}
      <section className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setErr(null)
              setVerifyMsg(null)
              const res = await verifyCredential(c.id)
              applyVerifyResult(res, setVerifyMsg, setErr)
            })
          }
        >
          Verificar
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!confirm(`¿Eliminar la conexión "${c.name}"?`)) return
            startTransition(async () => {
              const res = await deleteCredential(c.id)
              if (res.ok) onDeleted()
              else setErr(res.error)
            })
          }}
        >
          Eliminar
        </Button>
      </section>
    </div>
  )
}
