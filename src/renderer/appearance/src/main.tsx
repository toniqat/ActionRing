import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@settings/styles/settings.css'
import { AppearanceApp, ErrorBoundary } from './AppearanceApp'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <AppearanceApp />
    </ErrorBoundary>
  </StrictMode>
)
