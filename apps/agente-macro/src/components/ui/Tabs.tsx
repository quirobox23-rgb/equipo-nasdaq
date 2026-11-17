interface TabOption { value: string; label: string }

export function Tabs({ options, value, onChange }: { options: TabOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tabs">
      {options.map(opt => (
        <div
          key={opt.value}
          className={`tab ${value === opt.value ? 'tab-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  )
}
