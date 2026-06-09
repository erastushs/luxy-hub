'use server'

import { requireAuth } from '@/app/lib/auth/session-auth'
import {
  getEventHistory,
  getEventDetail,
  getDeadLetters,
  replayEvent,
  replayAllDeadLetters,
  type EventDashboardDTO,
} from '@/app/lib/services/event-dashboard-service'
import type { EventType, EventDeliveryStatus } from '@/app/lib/repositories/event-repository'

// ---------------------------------------------------------------------------
// Event list (paginated, filterable)
// ---------------------------------------------------------------------------

export type EventsActionState = {
  success: boolean
  events: EventDashboardDTO[]
  total: number
  page: number
  pageSize: number
  message?: string
}

export async function getEventsAction(
  slug: string,
  options?: {
    eventType?: EventType
    deliveryStatus?: EventDeliveryStatus
    page?: number
    pageSize?: number
  },
): Promise<EventsActionState> {
  const user = await requireAuth()
  const result = await getEventHistory(slug, user.id, options)
  if (!result.success) {
    return { success: false, events: [], total: 0, page: 1, pageSize: 20, message: result.message }
  }
  return { success: true, events: result.events, total: result.total, page: result.page, pageSize: result.pageSize }
}

// ---------------------------------------------------------------------------
// Event detail (single)
// ---------------------------------------------------------------------------

export type EventDetailActionState = {
  success: boolean
  event: EventDashboardDTO | null
  message?: string
}

export async function getEventDetailAction(
  slug: string,
  eventId: string,
): Promise<EventDetailActionState> {
  const user = await requireAuth()
  const result = await getEventDetail(slug, user.id, eventId)
  if (!result.success) {
    return { success: false, event: null, message: result.message }
  }
  return { success: true, event: result.event }
}

// ---------------------------------------------------------------------------
// Dead-letter list
// ---------------------------------------------------------------------------

export type DeadLettersActionState = {
  success: boolean
  events: EventDashboardDTO[]
  total: number
  page: number
  pageSize: number
  message?: string
}

export async function getDeadLettersAction(
  slug: string,
  options?: { page?: number; pageSize?: number },
): Promise<DeadLettersActionState> {
  const user = await requireAuth()
  const result = await getDeadLetters(slug, user.id, options)
  if (!result.success) {
    return { success: false, events: [], total: 0, page: 1, pageSize: 20, message: result.message }
  }
  return { success: true, events: result.events, total: result.total, page: result.page, pageSize: result.pageSize }
}

// ---------------------------------------------------------------------------
// Replay single dead-letter event
// ---------------------------------------------------------------------------

export type ReplayActionState = {
  success: boolean
  message: string
  replayed: number
}

export async function replayEventAction(
  slug: string,
  eventId: string,
): Promise<ReplayActionState> {
  const user = await requireAuth()
  const result = await replayEvent(slug, user.id, eventId)
  if (!result.success) {
    return { success: false, message: result.message, replayed: 0 }
  }
  return { success: true, message: result.message, replayed: result.replayed }
}

// ---------------------------------------------------------------------------
// Replay all dead-letter events
// ---------------------------------------------------------------------------

export async function replayAllDeadLettersAction(
  slug: string,
): Promise<ReplayActionState> {
  const user = await requireAuth()
  const result = await replayAllDeadLetters(slug, user.id)
  if (!result.success) {
    return { success: false, message: result.message, replayed: 0 }
  }
  return { success: true, message: result.message, replayed: result.replayed }
}
