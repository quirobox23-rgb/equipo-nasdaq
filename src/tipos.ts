export type AgenteId = 'macro' | 'noticias' | 'grafico' | 'estructura' | 'volumen' | 'volatilidad' | 'bienestar' | 'cuentas'

/** info: contexto. atencion: ve con cuidado. alerta: para y mira antes de operar. */
export type Nivel = 'info' | 'atencion' | 'alerta'

export type Semaforo = 'verde' | 'ambar' | 'rojo'

export interface Hallazgo {
  agente: AgenteId
  nivel: Nivel
  titulo: string
  detalle?: string
  /** Identificador estable para no repetir el mismo aviso en el día. */
  clave?: string
  /**
   * Aviso sobre un escenario de TU estrategia (no de riesgo). No cambia el
   * semáforo y no cuenta para el tope de avisos por hora.
   */
  estrategia?: boolean
}
