// Prefijo de rutas cuando Markets vive dentro de la oficina (/markets).
// Next añade el prefijo solo a <Link> y router; fetch, <img> y <a> lo necesitan a mano.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/markets'
export const conBase = (ruta: string) => `${BASE}${ruta}`
