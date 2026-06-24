"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"

import { runExpireStale } from "../actions"

export function MaintenancePanel() {
  const [pending, startTransition] = useTransition()
  const [expireResult, setExpireResult] = useState<number | null>(null)

  return (
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
              {expireResult === 1
                ? "transacción expirada"
                : "transacciones expiradas"}
              .
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
  )
}
