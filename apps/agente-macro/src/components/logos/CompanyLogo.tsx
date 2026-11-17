import { COMPANY_LOGOS } from './companyLogos'

interface CompanyLogoProps {
  ticker: string
  size?: number
  className?: string
}

// Renderiza el logo real de la marca si está en nuestra galería
// (src/components/logos/companyLogos.ts); si el ticker no está curado
// todavía, no renderiza nada — el caller decide el fallback (ej. ícono
// genérico por categoría).
export function CompanyLogo({ ticker, size = 16, className }: CompanyLogoProps) {
  const logo = COMPANY_LOGOS[ticker.toUpperCase()]
  if (!logo) return null

  return (
    <svg
      viewBox={logo.viewBox ?? '0 0 24 24'}
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role="img"
      aria-label={logo.name}
    >
      <path d={logo.path} />
    </svg>
  )
}
