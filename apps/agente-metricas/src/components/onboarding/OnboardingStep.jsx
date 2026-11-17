// ─────────────────────────────────────────────
//  ONBOARDING STEP — shell visual reutilizado por los 3 pasos
//
//  No lleva lógica propia: cada paso (OnboardingModal.jsx) le pasa
//  su icono, título, descripción y contenido específico.
// ─────────────────────────────────────────────
export default function OnboardingStep({ stepNumber, totalSteps, title, description, children }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 8 }}>
          Paso {stepNumber} de {totalSteps}
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, margin: '0 auto', maxWidth: 380 }}>{description}</p>
      </div>
      {children}
    </div>
  )
}
