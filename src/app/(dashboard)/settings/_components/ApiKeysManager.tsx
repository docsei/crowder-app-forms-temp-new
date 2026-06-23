"use client"

import { useState, useTransition } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
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
import { formatDateTime, maskKey } from "@/lib/formatters"

import {
  createApiKey,
  deleteApiKey,
  regenerateApiKey,
  renameApiKey,
  setApiKeyActive,
} from "../actions"

export type ApiKeyView = {
  id: string
  name: string
  secret: string
  active: boolean
  createdAt: string
  graceUntil: string | null
}

export function ApiKeysManager({ apiKeys }: { apiKeys: ApiKeyView[] }) {
  const [pending, startTransition] = useTransition()
  const [newName, setNewName] = useState("")
  // Secretos recién creados/regenerados que mostramos en claro una sola vez.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  // Key abierta en el drawer de detalle (la derivamos de la prop para que
  // refleje los cambios tras cada server action + revalidación).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = apiKeys.find((k) => k.id === selectedId) ?? null

  const reveal = (id: string) => setRevealed((r) => ({ ...r, [id]: true }))

  const openDetail = (id: string) => {
    setSelectedId(id)
    setEditing(false)
  }
  const closeDetail = () => {
    setSelectedId(null)
    setEditing(false)
  }

  return (
    <Card className="space-y-4 bg-background">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Crowder API Keys
          </h2>
          <p className="text-xs text-muted-foreground">
            Bearer que Crowder envía en cada request. Podés tener varias, darles
            nombre, desactivarlas y regenerarlas. Al regenerar, el secreto
            anterior sigue válido 24 h para no cortar integraciones en vivo.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre (ej: Producción, Staging)"
        />
        <Button
          disabled={pending || !newName.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await createApiKey(newName)
              setNewName("")
              reveal(res.id)
              openDetail(res.id)
            })
          }
        >
          Crear key
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no creaste ninguna API key. Creá una para empezar el onboarding
          con Crowder.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Secreto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((k) => (
                <tr key={k.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {k.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {maskKey(k.secret)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={k.active ? "success" : "neutral"}>
                      {k.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(k.id)}
                      className="text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail()
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selected?.name ?? "API key"}</DrawerTitle>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Creada el {formatDateTime(selected.createdAt)}
              </p>
            )}
          </DrawerHeader>

          {selected && (
            <DrawerBody className="space-y-6">
              {/* Nombre + renombrar */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nombre
                </h3>
                {editing ? (
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <Button
                      variant="secondary"
                      disabled={pending || !editName.trim()}
                      onClick={() =>
                        startTransition(async () => {
                          await renameApiKey(selected.id, editName)
                          setEditing(false)
                        })
                      }
                    >
                      Guardar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">
                      {selected.name}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground transition hover:text-foreground"
                      onClick={() => {
                        setEditing(true)
                        setEditName(selected.name)
                      }}
                    >
                      Renombrar
                    </button>
                  </div>
                )}
              </section>

              {/* Secreto */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Secreto
                </h3>
                <p className="break-all font-mono text-sm text-foreground">
                  {revealed[selected.id]
                    ? selected.secret
                    : maskKey(selected.secret)}
                </p>
                {!revealed[selected.id] && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                    onClick={() => reveal(selected.id)}
                  >
                    Mostrar
                  </button>
                )}
                {selected.graceUntil && (
                  <p className="text-xs text-muted-foreground">
                    El secreto anterior y el actual se aceptan a la vez hasta{" "}
                    {formatDateTime(selected.graceUntil)}, así la integración no
                    se corta durante el cambio. Después queda solo el actual; no
                    necesitás hacer nada más.
                  </p>
                )}
              </section>

              {/* Estado */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Estado
                </h3>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={selected.active}
                    disabled={pending}
                    onCheckedChange={(active) =>
                      startTransition(() =>
                        setApiKeyActive(selected.id, active),
                      )
                    }
                  />
                  <Label className="text-sm text-foreground">
                    {selected.active ? "Activa" : "Inactiva"}
                  </Label>
                </div>
              </section>

              {/* Acciones */}
              <section className="flex flex-wrap gap-3 border-t border-border pt-4">
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await regenerateApiKey(selected.id)
                      reveal(selected.id)
                    })
                  }
                >
                  Regenerar
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        `¿Eliminar la API key "${selected.name}"? Dejará de funcionar de inmediato.`,
                      )
                    )
                      return
                    startTransition(async () => {
                      await deleteApiKey(selected.id)
                      closeDetail()
                    })
                  }}
                >
                  Eliminar
                </Button>
              </section>
            </DrawerBody>
          )}
        </DrawerContent>
      </Drawer>
    </Card>
  )
}
