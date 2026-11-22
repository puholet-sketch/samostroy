import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { hydrateLocalCrmIfEmpty } from './lib/clients'
import { bootstrapRuntimeApiConfig } from './lib/feedbackConfig'
import './styles/globals.css'

async function boot() {
  await Promise.all([bootstrapRuntimeApiConfig(), hydrateLocalCrmIfEmpty()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
