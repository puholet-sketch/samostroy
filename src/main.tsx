import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { hydrateLocalCrmIfEmpty } from './lib/clients'
import './styles/globals.css'

async function boot() {
  await hydrateLocalCrmIfEmpty()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
