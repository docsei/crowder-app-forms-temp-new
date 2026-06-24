"use client"

import { RiSendPlaneLine } from "@remixicon/react"
import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/Badge"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { JsonBlock } from "@/components/dashboard/JsonBlock"
import {
  formatWebhookEvent,
  httpStatusVariant,
  truncateId,
} from "@/lib/formatters"
import { DateTime } from "@/components/DateTime"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { listAll } from "@/modules/webhooks"

type WebhookRow = Awaited<ReturnType<typeof listAll>>[number]

export function WebhooksTable({ events }: { events: WebhookRow[] }) {
  const [selected, setSelected] = useState<WebhookRow | null>(null)

  return (
    <>
      <TableRoot>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Evento</TableHeaderCell>
              <TableHeaderCell>Transacción</TableHeaderCell>
              <TableHeaderCell>Response</TableHeaderCell>
              <TableHeaderCell>Recibido</TableHeaderCell>
              <TableHeaderCell className="text-right">Detalles</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-foreground">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <RiSendPlaneLine
                      className="size-4 text-faint"
                      aria-hidden="true"
                    />
                    {formatWebhookEvent(e.status)}
                  </span>
                  <div className="ml-6 font-mono text-xs text-muted-foreground">
                    {e.status}
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/transactions/${e.transactionId}?tab=webhooks`}
                    className="font-mono text-xs text-secondary-foreground transition hover:text-primary"
                  >
                    {truncateId(e.transactionId, 18)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={httpStatusVariant(e.responseStatus)}>
                    HTTP {e.responseStatus}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                  <DateTime value={e.processedAt} />
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Ver detalles
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Detalles del webhook</DrawerTitle>
            {selected && (
              <p className="text-xs text-muted-foreground">
                {formatWebhookEvent(selected.status)} ·{" "}
                <span className="font-mono">{selected.status}</span>
              </p>
            )}
          </DrawerHeader>
          {selected && (
            <DrawerBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Meta label="Transacción">
                  <Link
                    href={`/transactions/${selected.transactionId}?tab=webhooks`}
                    className="font-mono text-secondary-foreground transition hover:text-primary"
                  >
                    {selected.transactionId}
                  </Link>
                </Meta>
                <Meta label="Response">
                  <Badge variant={httpStatusVariant(selected.responseStatus)}>
                    HTTP {selected.responseStatus}
                  </Badge>
                </Meta>
                <Meta label="Recibido">
                  <span className="font-mono tabular-nums text-secondary-foreground">
                    <DateTime value={selected.processedAt} />
                  </span>
                </Meta>
              </div>

              <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payload
                </h3>
                <JsonBlock value={selected.payload} />
              </section>

              <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Response body
                </h3>
                <JsonBlock value={selected.responseBody} />
              </section>
            </DrawerBody>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
