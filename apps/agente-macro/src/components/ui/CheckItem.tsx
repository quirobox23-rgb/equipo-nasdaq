import { Check } from 'lucide-react'

// CheckItem — selección múltiple tipo tarjeta. Estado activo siempre en
// marca (brand), sin importar la categoría — es un toggle, no un
// semáforo. Ver sección 5 del design system.
export function CheckItem({ text, checked, onToggle }: { text: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className={`check-item ${checked ? 'checked' : ''}`} onClick={onToggle}>
      <div className="w-4 h-4 rounded border border-base-line flex items-center justify-center shrink-0 bg-base-panel2">
        {checked && <Check size={11} className="text-brand" strokeWidth={3} />}
      </div>
      <div className="text-[12.5px] text-base-text">{text}</div>
    </div>
  )
}
