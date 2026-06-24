"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Checkbox } from "@/components/Checkbox"
import { Input } from "@/components/Input"
import { OriginsListEditor } from "@/components/OriginsListEditor"
import { CURRENCIES, CURRENCY_LIST } from "@/lib/products/currencies"
import { DEFAULT_BRAND_HEX } from "@/lib/theme"

import { updateAllowedOrigins, updateBrandPrimary, updateCurrencies } from "../actions"

export function EmbedSettings({
  currencies,
  allowedOrigins,
  brandPrimary,
}: {
  currencies: string[]
  allowedOrigins: string[]
  brandPrimary: string | null
}) {
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(currencies)
  const [brandInput, setBrandInput] = useState(brandPrimary ?? DEFAULT_BRAND_HEX)
  const [pending, startTransition] = useTransition()

  // Monedas a mostrar: el registro LATAM + cualquier código ya configurado que
  // no esté en el registro (no lo escondemos para no perderlo en silencio).
  const extraCodes = selectedCurrencies.filter((c) => !CURRENCIES[c])
  const toggleCurrency = (code: string) =>
    setSelectedCurrencies((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
    )

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <h2 className="text-sm font-semibold text-foreground">
          Monedas soportadas
        </h2>
        <p className="text-xs text-muted-foreground">
          Se guarda el código ISO 4217; el fan ve el símbolo. El iframe valida{" "}
          <code className="font-mono">context.currency</code> contra esta lista.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CURRENCY_LIST.map((c) => (
            <label
              key={c.code}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <Checkbox
                checked={selectedCurrencies.includes(c.code)}
                onCheckedChange={() => toggleCurrency(c.code)}
              />
              {c.country} —{" "}
              <span className="font-medium">{c.symbol}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                ({c.code})
              </span>
            </label>
          ))}
          {extraCodes.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <Checkbox checked onCheckedChange={() => toggleCurrency(code)} />
              <span className="font-mono text-xs">{code}</span>
              <span className="text-xs text-muted-foreground">
                (fuera del registro)
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() => updateCurrencies(selectedCurrencies))
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
            onClick={() => startTransition(() => updateBrandPrimary(brandInput))}
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
    </div>
  )
}
