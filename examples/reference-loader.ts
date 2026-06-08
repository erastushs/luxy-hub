import {
  decryptPayload,
  decompressPayload,
  validatePayload,
} from '../app/lib/delivery/payload-consumer'

type DeliverySessionResponse = {
  session_token: string
  expires_in: number
}

type DeliveryFetchResponse = {
  payload: string
  payload_format_version: string
  build_version: string
}

export type ReferenceLoaderParams = {
  baseUrl: string
  slug: string
  versionId: string
  sourceSha256: string
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

  const payload = validatePayload(delivery.payload)
  const compressedPayload = decryptPayload({
    payload,
    versionId: params.versionId,
    sourceSha256: params.sourceSha256,
    secret: params.payloadSecret,
  })
  const recoveredSource = decompressPayload(compressedPayload)

  if (params.execute) {
    await params.execute(recoveredSource)
  }

  return recoveredSource
}
