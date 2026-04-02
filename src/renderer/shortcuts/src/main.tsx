import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@settings/styles/settings.css'
import { ShortcutsApp, ErrorBoundary } from './ShortcutsApp'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ShortcutsApp />
    </ErrorBoundary>
  </StrictMode>
)
