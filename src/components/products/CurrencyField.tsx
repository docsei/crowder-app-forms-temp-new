"use client"

import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { currencyLabel } from "@/lib/products/currencies"

// Selector de moneda compartido: Select cuando hay monedas configuradas en
// Settings, Input de 3 letras como fallback. "__none__" mapea a "" (sin definir).
export function CurrencyField({
  value,
  onChange,
  supportedCurrencies,
  noneLabel = "Sin definir",
  inputPlaceholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  supportedCurrencies: string[]
  noneLabel?: string
  inputPlaceholder?: string
  disabled?: boolean
}) {
  if (supportedCurrencies.length > 0) {
    return (
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Elegí una moneda" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{noneLabel}</SelectItem>
          {supportedCurrencies.map((c) => (
            <SelectItem key={c} value={c}>
              {currencyLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      placeholder={inputPlaceholder}
      maxLength={3}
      disabled={disabled}
    />
  )
}
