// web-push não tem default export; usar require evita erro de tipos no build
const webPush = require('web-push') as typeof import('web-push')
import { prisma } from '../lib/prisma'

const VAPID_PUBLIC = process.env['VAPID_PUBLIC_KEY']
const VAPID_PRIVATE = process.env['VAPID_PRIVATE_KEY']
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails(
    `mailto:${process.env['VAPID_EMAIL'] ?? 'shield@centroseguro.com.br'}`,
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  )
}

interface PushPayload { title: string; body: string; zone_id: string; report_id: string }

export async function notifyZoneSubscribers(zoneId: string, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return
  const subs = await prisma.pushSubscription.findMany({ where: { zones: { has: zoneId } } })
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => null)
      }
    }
  }))
}
