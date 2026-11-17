import type { ButtonHTMLAttributes } from 'react'

// Button — variantes neutras, nunca semáforo (un botón no es un
// resultado). btn-primary lleva el degradé de marca con texto blanco.
//
// Los nombres de clase van en Records literales (no `btn-${variant}`
// interpolado) a propósito: Tailwind solo genera CSS para clases que
// aparecen como texto literal en el código, no para las armadas en
// runtime — con template string, btn-secondary/btn-outline/btn-sm/btn-lg
// se caían silenciosamente del build final.
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'lg'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  lg: 'btn-lg',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'secondary', size, className = '', children, ...props }: Props) {
  return (
    <button className={`${VARIANT_CLASS[variant]} ${size ? SIZE_CLASS[size] : ''} ${className}`} {...props}>
      {children}
    </button>
  )
}
