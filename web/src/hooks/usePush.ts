import { useState } from 'react'
import { subscribe } from '@/lib/api'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function usePush() {
  const [status, setStatus] = useState<'idle'|'loading'|'granted'|'denied'>('idle')
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window
  const VAPID = import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string

  const requestPermission = async (zones: string[]) => {
    if (!isSupported || !VAPID) return
    setStatus('loading')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource })
      const json = sub.toJSON()
      await subscribe({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' }, zones })
      setStatus('granted')
    } catch { setStatus('denied') }
  }

  return { status, isSupported, requestPermission }
}
