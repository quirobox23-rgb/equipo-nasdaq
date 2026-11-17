'use client'
import { PanelHeader } from '@/components/ui'
import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useAssetTechnicalContext, technicalContextStore, type DailyContext, type WeeklyContext } from '@/lib/dataProvider/TechnicalContext'
import { buildInterpretationLines } from '@/lib/technicalInterpretation'
import { useAlumno } from '@/lib/alumno'

function toNum(s: string): number | null {
  if (s.trim() === '') return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}
function toStr(n: number | null | undefined): string {
  return n == null ? '' : String(n)
}

// El equipo (nivel admin) edita los niveles; los alumnos solo los leen.
function Field({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  if (readOnly) {
    return (
      <div>
        <p className="text-[10px] text-base-muted mb-1">{label}</p>
        <p className="text-xs font-mono text-base-text">{value ? Number(value).toLocaleString('es-ES') : '—'}</p>
      </div>
    )
  }
  return (
    <div>
      <label className="text-[10px] text-base-muted block mb-1">{label}</label>
      <input
        type="number" step="any" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="mit-input w-full text-xs"
      />
    </div>
  )
}

interface Props {
  asset: string
  display: string
  /** Evento dominante real de la semana (o null) — nunca un catalizador inventado. */
  mainEventName?: string | null
}

export function AssetContextCard({ asset, display, mainEventName }: Props) {
  const ctx = useAssetTechnicalContext(asset)
  const [daily, setDaily]   = useState<Record<string, string>>({})
  const [weekly, setWeekly] = useState<Record<string, string>>({})
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const readOnly = useAlumno().nivel !== 'admin'

  // Recarga el formulario al cambiar de activo y cuando llegan los niveles del servidor.
  useEffect(() => {
    setDaily({
      currentPrice: toStr(ctx.daily.currentPrice),
      pdh: toStr(ctx.daily.pdh), pdl: toStr(ctx.daily.pdl),
      openDaily: toStr(ctx.daily.openDaily),
      asiaHigh: toStr(ctx.daily.asiaHigh), asiaLow: toStr(ctx.daily.asiaLow),
      frankfurtHigh: toStr(ctx.daily.frankfurtHigh), frankfurtLow: toStr(ctx.daily.frankfurtLow),
      londonHigh: toStr(ctx.daily.londonHigh), londonLow: toStr(ctx.daily.londonLow),
      vwap: toStr(ctx.daily.vwap),
    })
    setWeekly({
      pwh: toStr(ctx.weekly.pwh), pwl: toStr(ctx.weekly.pwl),
      pmh: toStr(ctx.weekly.pmh), pml: toStr(ctx.weekly.pml),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, ctx.updatedAt])

  async function handleSave() {
    const d: DailyContext = {
      currentPrice: toNum(daily.currentPrice ?? ''), pdh: toNum(daily.pdh ?? ''), pdl: toNum(daily.pdl ?? ''),
      openDaily: toNum(daily.openDaily ?? ''),
      asiaHigh: toNum(daily.asiaHigh ?? ''), asiaLow: toNum(daily.asiaLow ?? ''),
      frankfurtHigh: toNum(daily.frankfurtHigh ?? ''), frankfurtLow: toNum(daily.frankfurtLow ?? ''),
      londonHigh: toNum(daily.londonHigh ?? ''), londonLow: toNum(daily.londonLow ?? ''),
      vwap: toNum(daily.vwap ?? ''),
    }
    const w: WeeklyContext = {
      pwh: toNum(weekly.pwh ?? ''), pwl: toNum(weekly.pwl ?? ''),
      pmh: toNum(weekly.pmh ?? ''), pml: toNum(weekly.pml ?? ''),
    }
    setError(null)
    try {
      await technicalContextStore.save(asset, d, w)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const lines = buildInterpretationLines(ctx, mainEventName)

  return (
    <section className="card">
      <PanelHeader title={display} aside={asset} />
      <div className="p-5">

      <p className="text-[10px] text-base-muted uppercase tracking-widest mb-2">Contexto diario</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Field label="Precio actual" value={daily.currentPrice ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, currentPrice: v }))} />
        <Field label="VWAP (opcional)" value={daily.vwap ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, vwap: v }))} />
        <Field label="PDH" value={daily.pdh ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, pdh: v }))} />
        <Field label="PDL" value={daily.pdl ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, pdl: v }))} />
        <Field label="Open diario" value={daily.openDaily ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, openDaily: v }))} />
        <div />
        <Field label="Asia High" value={daily.asiaHigh ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, asiaHigh: v }))} />
        <Field label="Asia Low" value={daily.asiaLow ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, asiaLow: v }))} />
        <Field label="Frankfurt High" value={daily.frankfurtHigh ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, frankfurtHigh: v }))} />
        <Field label="Frankfurt Low" value={daily.frankfurtLow ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, frankfurtLow: v }))} />
        <Field label="London High" value={daily.londonHigh ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, londonHigh: v }))} />
        <Field label="London Low" value={daily.londonLow ?? ''} readOnly={readOnly} onChange={v => setDaily(p => ({ ...p, londonLow: v }))} />
      </div>

      <p className="text-[10px] text-base-muted uppercase tracking-widest mb-2">Contexto semanal</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Field label="Weekly High (PWH)" value={weekly.pwh ?? ''} readOnly={readOnly} onChange={v => setWeekly(p => ({ ...p, pwh: v }))} />
        <Field label="Weekly Low (PWL)" value={weekly.pwl ?? ''} readOnly={readOnly} onChange={v => setWeekly(p => ({ ...p, pwl: v }))} />
        <Field label="Monthly High (PMH)" value={weekly.pmh ?? ''} readOnly={readOnly} onChange={v => setWeekly(p => ({ ...p, pmh: v }))} />
        <Field label="Monthly Low (PML)" value={weekly.pml ?? ''} readOnly={readOnly} onChange={v => setWeekly(p => ({ ...p, pml: v }))} />
      </div>

      {readOnly ? (
        ctx.updatedAt && (
          <p className="text-[10.5px] text-base-muted mb-4">
            Actualizado el {new Date(ctx.updatedAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )
      ) : (
        <>
          <button onClick={handleSave} className="btn-primary text-xs w-full mb-2">
            {saved ? <><Check size={13} /> Guardado para todos los alumnos</> : 'Guardar para los alumnos'}
          </button>
          {error && <p className="text-[11px] text-neg mb-2">{error}</p>}
          <div className="mb-2" />
        </>
      )}

      <div className="border-t border-base-line pt-3">
        <p className="text-[10px] text-base-muted uppercase tracking-widest mb-2">Interpretación automática</p>
        <ul className="space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className="text-[12px] text-base-text/85 leading-relaxed flex gap-1.5">
              <span className="text-base-muted shrink-0">•</span>{l}
            </li>
          ))}
        </ul>
      </div>
      </div>
    </section>
  )
}
