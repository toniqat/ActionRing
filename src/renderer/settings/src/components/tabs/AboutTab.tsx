export function AboutTab(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 48 }}>⭕</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', letterSpacing: 2 }}>ACTIONRING</h1>
      <p style={{ fontSize: 13, color: 'var(--c-text-dim)' }}>Version 1.0.0</p>
      <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        A standalone action ring overlay — inspired by the Logitech MX Master 4.
      </p>
    </div>
  )
}
