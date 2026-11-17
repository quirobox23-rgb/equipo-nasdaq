import { useState } from 'react'
import { MAPPABLE_FIELDS } from '@/importers/mappingEngine'

// ─────────────────────────────────────────────
//  ASISTENTE DE MAPEO MANUAL DE COLUMNAS
//
//  Se muestra cuando ningún formato conocido (legacy ni por firma)
//  reconoce el CSV. El usuario asigna cada columna del archivo a un
//  campo del modelo. Al confirmar, ese mapeo se recuerda (por el
//  llamador, vía useImportFormatsStore) para no volver a preguntar
//  la próxima vez que aparezcan las mismas columnas.
// ─────────────────────────────────────────────

export default function ColumnMappingWizard({ headers, onConfirm, onCancel }) {
  const [mapping, setMapping] = useState({})

  const setField = (fieldKey, value) => {
    setMapping(m => ({ ...m, [fieldKey]: value === '' ? undefined : parseInt(value, 10) }))
  }

  const missingRequired = MAPPABLE_FIELDS.filter(f => f.required && mapping[f.key] === undefined)

  return (
    <div>
      <div className="card-title">Formato no reconocido — asigna las columnas</div>
      <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
        No hemos podido identificar automáticamente este CSV. Indica a qué corresponde cada
        columna. La próxima vez que importes un archivo con estas mismas columnas, no se
        volverá a preguntar.
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        {MAPPABLE_FIELDS.map(f => (
          <div className="form-group" key={f.key} style={{ marginBottom: 0 }}>
            <label>{f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}</label>
            <select value={mapping[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)}>
              <option value="">— No aplica —</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>{h ? h : `Columna ${i + 1}`}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 11,
          background: 'var(--red2)', border: '1px solid rgba(255,90,106,0.2)', color: 'var(--red)',
        }}>
          Faltan por asignar: {missingRequired.map(f => f.label).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={missingRequired.length > 0}
          onClick={() => onConfirm(mapping)}
        >
          Confirmar mapeo →
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
