import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@settings/styles/settings.css'
import { PopupMenu } from './PopupMenu'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <PopupMenu />
  </StrictMode>
)
