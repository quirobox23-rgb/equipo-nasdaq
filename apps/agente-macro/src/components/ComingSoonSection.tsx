import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  title: string
  description: string
}

export function ComingSoonSection({ icon, title, description }: Props) {
  return (
    <div className="min-h-[calc(100vh-56px-3rem)] flex items-center justify-center">
      <div className="card max-w-md w-full p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-base-panel2 border border-base-line flex items-center justify-center text-brand mx-auto mb-4">
          {icon}
        </div>
        <h1 className="text-lg font-semibold text-base-text mb-2">{title}</h1>
        <p className="text-sm text-base-muted leading-relaxed mb-5">{description}</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-base-muted border border-base-line rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral" />
          Próximamente
        </span>
      </div>
    </div>
  )
}
