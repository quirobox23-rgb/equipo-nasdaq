'use client'
import { useState } from 'react'
import type { VerdictClass } from '@/types/macro'
import { TECH_ZONES, getTechCombo } from '@/lib/engines/techCombos'

interface Props {
  verdictClass: VerdictClass
}

const RISK_STYLES: Record<string, string> = {
  bajo:     'text-pos',
  moderado: 'text-neutral',
  alto:     'text-neg',
}

export function TechComboPanel({ verdictClass }: Props) {
  const [selectedZone, setSelectedZone] = useState<string>('')

  const combo = selectedZone ? getTechCombo(selectedZone, verdictClass) : null

  return (
    <div className="card p-3">
      <p className="card-title">Zona técnica</p>

      {/* Zone selector */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {TECH_ZONES.map((z) => (
          <button
            key={z.key}
            onClick={() => setSelectedZone(z.key === selectedZone ? '' : z.key)}
            className={`text-left px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
              selectedZone === z.key
                ? 'bg-base-line border-base-muted text-base-text'
                : 'bg-base-panel2/40 border-base-line/50 text-base-muted hover:border-base-muted hover:text-base-text/85'
            }`}
          >
            {z.label}
          </button>
        ))}
      </div>

      {/* Combo result */}
      {combo ? (
        <div className="bg-base-panel2/50 rounded-md p-3 space-y-2">
          <p className="text-xs font-semibold text-base-text/90">{combo.action}</p>
          <p className="text-xs text-base-muted leading-relaxed">{combo.rationale}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-base-muted">Riesgo:</span>
            <span className={`text-[10px] font-semibold uppercase ${RISK_STYLES[combo.risk]}`}>
              {combo.risk}
            </span>
          </div>
        </div>
      ) : selectedZone ? (
        <p className="text-xs text-base-muted">Sin combinación para esta zona.</p>
      ) : (
        <p className="text-xs text-base-muted">Selecciona una zona para ver la combinación macro × técnica.</p>
      )}
    </div>
  )
}
