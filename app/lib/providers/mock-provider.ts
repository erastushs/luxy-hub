import type { DeliveryProvider, DeliveryResult } from '@/app/lib/services/event-queue-service'
import type { EventLogRow } from '@/app/lib/repositories/event-repository'

/**
 * Stub delivery provider — always succeeds.
 *
 * Used during Phase 8B.3 to validate the queue lifecycle before
 * Discord/Telegram/Slack integrations are wired in.
 */

export const mockProvider: DeliveryProvider = {
  async deliver(event: EventLogRow, webhookUrl: string): Promise<DeliveryResult> {
    void event
    void webhookUrl
    return { success: true, retryable: false }
  },
}
