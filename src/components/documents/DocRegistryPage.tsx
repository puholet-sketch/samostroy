import { Navigate, useSearchParams } from 'react-router-dom'

/** Alias: full registry lives on the documents hub. */
export default function DocRegistryPage() {
  const [params] = useSearchParams()
  const q = params.toString()
  return <Navigate to={q ? `/documents?${q}` : '/documents'} replace />
}
