export function AboutTab(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, color: 'var(--c-text-muted)', padding: '32px 0' }}>
      <svg
        width="80"
        height="80"
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
      >
        <defs>
          <linearGradient
            id="aboutIconGrad"
            x1="48.804039"
            y1="48.804039"
            x2="207.19595"
            y2="207.19595"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#f64161" />
            <stop offset="1" stopColor="#934161" />
          </linearGradient>
        </defs>
        <circle
          cx="128"
          cy="128"
          r="90"
          fill="none"
          stroke="url(#aboutIconGrad)"
          strokeWidth="48"
          strokeLinecap="round"
        />
      </svg>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', letterSpacing: 2, margin: 0 }}>ACTIONRING</h1>
      <p style={{ fontSize: 13, color: 'var(--c-text-dim)', margin: 0 }}>Version 1.0.0</p>
    </div>
  )
}
