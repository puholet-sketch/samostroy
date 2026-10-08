import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { RenovationObject } from '../services/types'

export function useObjects() {
  const { user } = useAuth()
  const [objects, setObjects] = useState<RenovationObject[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) {
      setObjects([])
      setLoading(false)
      return
    }
    setLoading(true)
    const list = await api.objects.forUser(user)
    setObjects(list)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  return { objects, loading, reload }
}
