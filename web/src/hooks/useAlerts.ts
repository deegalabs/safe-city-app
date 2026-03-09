import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveReports } from '@/lib/api'
import type { Report } from '@/types'

export function useAlerts(zoneId?: string) {
  const [alerts, setAlerts] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    void getActiveReports(zoneId).then((r) => {
      if (r.data) setAlerts(r.data)
      setLoading(false)
    })
  }, [zoneId])

  useEffect(() => {
    const client = supabase
    if (client) {
      const channel = client
        .channel('reports-rt')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'reports', ...(zoneId ? { filter: `zone_id=eq.${zoneId}` } : {}) },
          (p) => {
            setAlerts((prev) => [p.new as Report, ...prev])
          }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, (p) => {
          const u = p.new as Report
          setAlerts((prev) =>
            u.status === 'expirado' || u.status === 'removido' ? prev.filter((a) => a.id !== u.id) : prev.map((a) => (a.id === u.id ? u : a))
          )
        })
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    }

    intervalRef.current = setInterval(() => {
      void getActiveReports(zoneId).then((r) => {
        if (r.data) setAlerts(r.data)
      })
    }, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [zoneId])

  return { alerts, loading }
}
