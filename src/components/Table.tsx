// Tabla del dashboard. Un solo origen de verdad para el estilo de los listados
// (transactions, forms, catalogs, webhooks, api keys…) que antes copiaban el
// mismo markup. Las clases base se mergean con `cx` (twMerge), así que cualquier
// celda puede sobreescribir alineación/tipografía vía `className`.

import React from "react"

import { cx } from "@/lib/utils"

// Envoltorio scrollable horizontal. Reemplaza el `<div className="overflow-x-auto">`
// (o el `<Card p-0>`) que cada tabla repetía.
const TableRoot = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, forwardedRef) => (
  <div
    ref={forwardedRef}
    className={cx("w-full overflow-x-auto", className)}
    {...props}
  />
))
TableRoot.displayName = "TableRoot"

const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentPropsWithoutRef<"table">
>(({ className, ...props }, forwardedRef) => (
  <table
    ref={forwardedRef}
    className={cx("w-full text-left text-sm", className)}
    {...props}
  />
))
Table.displayName = "Table"

const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"thead">
>(({ className, ...props }, forwardedRef) => (
  <thead
    ref={forwardedRef}
    className={cx(
      "border-b border-border text-xs uppercase text-muted-foreground",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentPropsWithoutRef<"th">
>(({ className, ...props }, forwardedRef) => (
  <th
    ref={forwardedRef}
    className={cx("px-4 py-3 font-medium", className)}
    {...props}
  />
))
TableHeaderCell.displayName = "TableHeaderCell"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"tbody">
>(({ className, ...props }, forwardedRef) => (
  <tbody ref={forwardedRef} className={className} {...props} />
))
TableBody.displayName = "TableBody"

// `hover` activa el realce de fila clickeable (listados con link/acción por fila).
interface TableRowProps extends React.ComponentPropsWithoutRef<"tr"> {
  hover?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, hover, ...props }, forwardedRef) => (
    <tr
      ref={forwardedRef}
      className={cx(
        "border-b border-border last:border-0",
        hover && "transition hover:bg-muted/40",
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentPropsWithoutRef<"td">
>(({ className, ...props }, forwardedRef) => (
  <td ref={forwardedRef} className={cx("px-4 py-3", className)} {...props} />
))
TableCell.displayName = "TableCell"

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
}
