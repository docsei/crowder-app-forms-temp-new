import { MaintenancePanel } from "../_components/MaintenancePanel"

export const dynamic = "force-dynamic"

export default function MaintenancePage() {
  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Mantenimiento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tareas operativas que antes corrían en un cron.
        </p>
      </div>

      <MaintenancePanel />
    </main>
  )
}
