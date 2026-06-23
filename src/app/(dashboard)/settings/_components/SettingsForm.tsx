"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { OriginsListEditor } from "@/components/OriginsListEditor"
import { DEFAULT_BRAND_HEX } from "@/lib/theme"

import {
  runExpireStale,
  updateAllowedOrigins,
  updateBrandPrimary,
  updateCurrencies,
} from "../actions"
import { ApiKeysManager, type ApiKeyView } from "./ApiKeysManager"

export function SettingsForm({
  apiKeys,
  currencies,
  allowedOrigins,
  brandPrimary,
}: {
  apiKeys: ApiKeyView[]
  currencies: string[]
  allowedOrigins: string[]
  brandPrimary: string | null
}) {
  const [currenciesInput, setCurrenciesInput] = useState(currencies.join(", "))
  const [brandInput, setBrandInput] = useState(brandPrimary ?? DEFAULT_BRAND_HEX)
  const [pending, startTransition] = useTransition()
  const [expireResult, setExpireResult] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      <ApiKeysManager apiKeys={apiKeys} />

      <Card className="bg-background">
        <h2 className="text-sm font-semibold text-foreground">
          Monedas soportadas
        </h2>
        <p className="text-xs text-muted-foreground">
          ISO 4217, separadas por coma. El iframe valida{" "}
          <code className="font-mono">context.currency</code> contra esta lista.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={currenciesInput}
            onChange={(e) => setCurrenciesInput(e.target.value)}
            placeholder="ARS, BRL, USD"
          />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                updateCurrencies(
                  currenciesInput.split(",").map((s) => s.trim()),
                ),
              )
            }
          >
            Guardar
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 bg-background">
        <h2 className="text-sm font-semibold text-foreground">
          Origins parent permitidos (global)
        </h2>
        <OriginsListEditor
          title="Orígenes globales"
          description="Lista base que heredan todos los forms que no definan la suya propia. Cada form puede sobreescribirla desde su pestaña de Integración."
          initial={allowedOrigins}
          onSave={updateAllowedOrigins}
        />
      </Card>

      <Card className="bg-background">
        <h2 className="text-sm font-semibold text-foreground">
          Color de marca (embed)
        </h2>
        <p className="text-xs text-muted-foreground">
          Se aplica solo dentro del iframe del formulario: botones primarios,
          foco de inputs y acentos. El resto del dashboard mantiene el look
          Crowder.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="color"
            aria-label="Color primario"
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background p-1"
          />
          <Input
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            placeholder={DEFAULT_BRAND_HEX}
            className="max-w-[160px] font-mono"
          />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() => updateBrandPrimary(brandInput))
            }
          >
            Guardar
          </Button>
          {brandPrimary && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await updateBrandPrimary(null)
                  setBrandInput(DEFAULT_BRAND_HEX)
                })
              }
            >
              Restablecer
            </Button>
          )}
        </div>
      </Card>

      <Card className="bg-background">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Expirar transacciones vencidas
            </h2>
            <p className="text-xs text-muted-foreground">
              Marca como <code className="font-mono">expired</code> las
              transacciones que pasaron su deadline sin confirmarse. Antes lo
              corría un cron de Vercel; ahora se dispara desde acá.
            </p>
            {expireResult !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Última ejecución: {expireResult}{" "}
                {expireResult === 1 ? "transacción expirada" : "transacciones expiradas"}.
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await runExpireStale()
                setExpireResult(res.expired)
              })
            }
          >
            Ejecutar ahora
          </Button>
        </div>
      </Card>
    </div>
  )
}
