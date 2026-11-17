import type { CSSProperties, ReactNode } from 'react'

// Card — contenedor por defecto (.card en globals.css), título opcional
// vía card-title (Nivel 0: 16px/900/uppercase + divisor). Ver sección 4
// del design system: "Card estándar".
interface CardProps {
  children: ReactNode
  title?: string
  className?: string
  style?: CSSProperties
}

export function Card({ children, title, className = '', style }: CardProps) {
  return (
    <div className={`card p-6 ${className}`} style={style}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  )
}

// PageHeader — título de página + subtítulo, con slot opcional a la
// derecha (ej. un CTA o el ThemeToggle).
interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6 mb-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-base-text tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-base-muted mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  )
}
