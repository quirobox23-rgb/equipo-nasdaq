import { useSearchParams } from 'react-router-dom'

// Entropia Control: varias páginas de siempre bajo una misma sección, con
// pestañas arriba. La pestaña va en la URL (?p=…) para poder enlazarla.
export default function Pestanas({ pestanas }) {
  const [params, setParams] = useSearchParams()
  const actual = pestanas.find((p) => p.id === params.get('p')) ?? pestanas[0]
  const Pagina = actual.Componente
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 16px 0' }}>
        <div className="tabs" role="tablist">
          {pestanas.map((p) => (
            <div
              key={p.id}
              role="tab"
              tabIndex={0}
              aria-selected={p.id === actual.id}
              className={`tab${p.id === actual.id ? ' active' : ''}`}
              onClick={() => setParams({ p: p.id }, { replace: true })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setParams({ p: p.id }, { replace: true }) }}
            >
              {p.label}
            </div>
          ))}
        </div>
      </div>
      <Pagina key={actual.id} />
    </>
  )
}
