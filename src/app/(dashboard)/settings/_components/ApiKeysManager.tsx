"use client"

import { useState, useTransition } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
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
  const [addOpen, setAddOpen] = useState(false)
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
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            API Keys
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bearer que Crowder envía en cada request. Podés tener varias, darles
            nombre, desactivarlas y regenerarlas. Al regenerar, el secreto
            anterior sigue válido 24 h para no cortar integraciones en vivo.
          </p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o)
            if (!o) setNewName("")
          }}
        >
          <DialogTrigger asChild>
            <Button>Crear key</Button>
          </DialogTrigger>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Crear API key</DialogTitle>
              <DialogDescription>
                Dale un nombre para identificarla. El secreto se genera al
                crearla y lo ves una vez en el detalle.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-1">
              <Label>Nombre</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre (ej: Producción, Staging)"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAddOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={pending || !newName.trim()}
                onClick={() => {
                  setAddOpen(false)
                  startTransition(async () => {
                    const res = await createApiKey(newName)
                    setNewName("")
                    reveal(res.id)
                    openDetail(res.id)
                  })
                }}
              >
                Crear key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys.length === 0 ? (
        <Card className="bg-background">
          <p className="text-sm text-muted-foreground">
            Aún no creaste ninguna API key. Creá una para empezar el onboarding
            con Crowder.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-background p-0">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Secreto</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell className="text-right">Detalle</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {k.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {maskKey(k.secret)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.active ? "success" : "neutral"}>
                        {k.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(k.id)}
                        className="text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        Ver detalle
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
    </div>
  )
}
