import { consumeDeliveryPayloadV1 } from '../app/lib/loader/loader-runtime-v1'

type DeliverySessionResponse = {
  session_token: string
  expires_in: number
}

type DeliveryFetchResponse = {
  payload: string
  context: {
    build_id: string
    version_id: string
    source_sha256: string
    payload_sha256: string
  }
  payload_format_version: string
  build_version: string
}

export type ReferenceLoaderParams = {
  baseUrl: string
  slug: string
  payloadSecret?: string
  execute?: (source: string) => void | Promise<void>
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error('Reference loader request failed')
  }

  return data as T
}

export async function runReferenceLoader(params: ReferenceLoaderParams): Promise<string> {
  const baseUrl = params.baseUrl.replace(/\/$/, '')

  const session = await postJson<DeliverySessionResponse>(
    `${baseUrl}/api/delivery/session`,
    { slug: params.slug }
  )

  const delivery = await postJson<DeliveryFetchResponse>(
    `${baseUrl}/api/delivery/fetch`,
    { session_token: session.session_token }
  )

  const result = await consumeDeliveryPayloadV1({
    response: delivery,
    secret: params.payloadSecret,
    execute: params.execute,
  })

  return result.source
}
