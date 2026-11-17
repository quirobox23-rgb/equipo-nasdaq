import type { Alert, AlertSeverity } from '@/lib/engines/alertEngine'

interface Props {
  alerts: Alert[]
}

const SEVERITY_STYLES: Record<AlertSeverity, { border: string; icon: string; title: string }> = {
  critical: {
    border: 'border-l-neg',
    icon:   'text-neg',
    title:  'text-neg',
  },
  warning: {
    border: 'border-l-neutral',
    icon:   'text-neutral',
    title:  'text-neutral',
  },
  info: {
    border: 'border-l-base-muted',
    icon:   'text-base-muted',
    title:  'text-base-text/85',
  },
}

function AlertItem({ alert: a }: { alert: Alert }) {
  const styles = SEVERITY_STYLES[a.severity]
  return (
    <div className={`border-l-2 ${styles.border} pl-3 py-2 bg-base-panel/60 rounded-r-md`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold leading-tight ${styles.title}`}>
          {a.title}
        </p>
        <span className="text-[10px] text-base-muted shrink-0 tabular">{a.time}</span>
      </div>
      <p className="text-[11px] text-base-muted mt-1 leading-relaxed">{a.sub}</p>
      {a.actionable && (
        <span className="inline-block mt-1.5 text-[9px] font-medium text-base-muted border border-base-line rounded px-1.5 py-0.5">
          ACCIONABLE
        </span>
      )}
    </div>
  )
}

export function AlertPanel({ alerts }: Props) {
  if (!alerts.length) {
    return (
      <div className="card p-4 text-center">
        <p className="text-xs text-base-muted">Sin alertas activas</p>
        <p className="text-[11px] text-base-line mt-1">Selecciona un evento para generar alertas</p>
      </div>
    )
  }

  const critical = alerts.filter((a) => a.severity === 'critical')
  const warning  = alerts.filter((a) => a.severity === 'warning')
  const info     = alerts.filter((a) => a.severity === 'info')

  return (
    <div className="space-y-2">
      {[...critical, ...warning, ...info].map((a) => (
        <AlertItem key={a.id} alert={a} />
      ))}
    </div>
  )
}
