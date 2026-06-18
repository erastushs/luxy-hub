export const AUTH_USER_ID_HEADER = 'x-luxy-auth-user-id'
export const AUTH_USER_EMAIL_HEADER = 'x-luxy-auth-user-email'
export const AUTH_USER_DISPLAY_NAME_HEADER = 'x-luxy-auth-user-display-name'
export const AUTH_USER_AVATAR_URL_HEADER = 'x-luxy-auth-user-avatar-url'

const AUTH_HEADERS = [
  AUTH_USER_ID_HEADER,
  AUTH_USER_EMAIL_HEADER,
  AUTH_USER_DISPLAY_NAME_HEADER,
  AUTH_USER_AVATAR_URL_HEADER,
]

export type RequestAuthHeaders = {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

type HeaderReader = Pick<Headers, 'get'>

export function clearRequestAuthHeaders(headers: Headers) {
  for (const header of AUTH_HEADERS) {
    headers.delete(header)
  }
}

export function setRequestAuthHeaders(headers: Headers, auth: RequestAuthHeaders) {
  headers.set(AUTH_USER_ID_HEADER, encodeHeaderValue(auth.id))

  setNullableHeader(headers, AUTH_USER_EMAIL_HEADER, auth.email)
  setNullableHeader(headers, AUTH_USER_DISPLAY_NAME_HEADER, auth.displayName)
  setNullableHeader(headers, AUTH_USER_AVATAR_URL_HEADER, auth.avatarUrl)
}

export function readRequestAuthHeaders(headers: HeaderReader): RequestAuthHeaders | null {
  const id = decodeHeaderValue(headers.get(AUTH_USER_ID_HEADER))

  if (!id) {
    return null
  }

  return {
    id,
    email: decodeHeaderValue(headers.get(AUTH_USER_EMAIL_HEADER)),
    displayName: decodeHeaderValue(headers.get(AUTH_USER_DISPLAY_NAME_HEADER)),
    avatarUrl: decodeHeaderValue(headers.get(AUTH_USER_AVATAR_URL_HEADER)),
  }
}

function setNullableHeader(headers: Headers, header: string, value: string | null) {
  if (value) {
    headers.set(header, encodeHeaderValue(value))
  } else {
    headers.delete(header)
  }
}

function encodeHeaderValue(value: string): string {
  return encodeURIComponent(value)
}

function decodeHeaderValue(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}
