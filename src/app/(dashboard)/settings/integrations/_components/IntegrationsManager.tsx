"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"
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

import { setProviderEnabled } from "../actions"
import { PROVIDER_FIELDS, type CredentialView } from "../provider-fields"

export function IntegrationsManager({
  enabledProviders,
  availableProviders,
  credentials,
}: {
  enabledProviders: Provider[]
  availableProviders: Provider[]
  credentials: CredentialView[]
}) {
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)

  // Proveedores con adapter que el partner todavía no activó.
  const addable = availableProviders.filter((p) => !enabledProviders.includes(p))

  function enableProvider(p: Provider) {
    // Cerramos el diálogo y la integración queda listada; el usuario entra a
    // configurarla con un click aparte (su página de detalle).
    setAddOpen(false)
    startTransition(async () => {
      await setProviderEnabled(p, true)
    })
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Integraciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agregá conexiones a e-commerce (Shopify) para sincronizar catálogos
            de productos. Distinto de las API keys: acá guardamos credenciales de
            un tercero para consumir su API.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={addable.length === 0}>
          Agregar
        </Button>
      </div>

      {enabledProviders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 bg-background py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Sin integraciones
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Agregá una integración para conectar tu e-commerce y sincronizar
            catálogos de productos.
          </p>
          <Button
            variant="secondary"
            onClick={() => setAddOpen(true)}
            disabled={addable.length === 0}
          >
            Agregar integración
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-background p-0">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Proveedor</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Conexiones</TableHeaderCell>
                  <TableHeaderCell className="text-right">Abrir</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {enabledProviders.map((p) => {
                  const conns = credentials.filter((c) => c.provider === p)
                  const activeCount = conns.filter((c) => c.active).length
                  return (
                    <TableRow key={p}>
                      <TableCell className="font-medium text-foreground">
                        {PROVIDER_FIELDS[p].label}
                      </TableCell>
                      <TableCell>
                        <Badge variant={activeCount > 0 ? "success" : "neutral"}>
                          {activeCount > 0 ? "Activa" : "Sin conexión activa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {conns.length === 0
                          ? "Sin conexiones"
                          : `${conns.length} conexión${conns.length === 1 ? "" : "es"} · ${activeCount} activa${activeCount === 1 ? "" : "s"}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/settings/integrations/${p}`}
                          className="text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          Ver detalle
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableRoot>
        </Card>
      )}

      <AddIntegrationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        addable={addable}
        pending={pending}
        onAdd={enableProvider}
      />
    </div>
  )
}

// ─── Agregar: elegir entre las integraciones disponibles ─────────────────────

function AddIntegrationDialog({
  open,
  onOpenChange,
  addable,
  pending,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  addable: Provider[]
  pending: boolean
  onAdd: (p: Provider) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar integración</DialogTitle>
          <DialogDescription>
            Elegí un proveedor para activarlo. Después vas a poder entrar a
            configurarlo y conectar tus credenciales.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {addable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ya agregaste todas las integraciones disponibles.
            </p>
          ) : (
            <ul className="space-y-2">
              {addable.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onAdd(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition hover:border-foreground/30 disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {PROVIDER_FIELDS[p].label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {PROVIDER_FIELDS[p].description}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-foreground">
                      Agregar
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
