import type { NextConfig } from 'next'

// Entropia Markets se sirve dentro de la oficina, en /markets. Con
// NEXT_PUBLIC_BASE_PATH= (vacío) vuelve a funcionar en la raíz por separado.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/markets'

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
