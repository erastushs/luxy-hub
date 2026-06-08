import { isValidSlug } from '@/app/lib/validators'
import {
  LOADER_RUNTIME_VERSION,
  LOADER_SUPPORTED_BUILD_VERSION,
  LOADER_SUPPORTED_PAYLOAD_FORMAT_VERSION,
} from '@/app/lib/loader/loader-constants'

export type LoaderBootstrapParams = {
  baseUrl: string
  slug: string
}

function luaString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}"`
}

function normalizeBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl)
  return parsed.origin.replace(/\/$/, '')
}

export function createLoaderBootstrapLua(params: LoaderBootstrapParams): string {
  if (!isValidSlug(params.slug)) {
    throw new Error('Invalid loader slug')
  }

  const baseUrl = normalizeBaseUrl(params.baseUrl)

  return `-- LuxyHub production loader bootstrap
-- Runtime: ${LOADER_RUNTIME_VERSION}
-- Payloads are fetched through one-time delivery sessions and are not embedded here.

local LUXY_BASE_URL = ${luaString(baseUrl)}
local LUXY_SLUG = ${luaString(params.slug)}
local RUNTIME_VERSION = ${luaString(LOADER_RUNTIME_VERSION)}
local SUPPORTED_PAYLOAD_FORMAT_VERSION = ${luaString(LOADER_SUPPORTED_PAYLOAD_FORMAT_VERSION)}
local SUPPORTED_BUILD_VERSION = ${luaString(LOADER_SUPPORTED_BUILD_VERSION)}
local SUPPORTED_ENCRYPTION_SCHEME = "aes-256-gcm:v1"
local SUPPORTED_COMPRESSION = "gzip"

local HttpService = game:GetService("HttpService")

local function fail()
  error("LuxyHub loader failed", 0)
end

local function getRequest()
  return (syn and syn.request)
    or http_request
    or request
    or (http and http.request)
end

local function postJson(path, body)
  local requestImpl = getRequest()
  if type(requestImpl) ~= "function" then
    fail()
  end

  local response = requestImpl({
    Url = LUXY_BASE_URL .. path,
    Method = "POST",
    Headers = {
      ["Content-Type"] = "application/json",
      ["Cache-Control"] = "no-store",
    },
    Body = HttpService:JSONEncode(body),
  })

  if type(response) ~= "table" then
    fail()
  end

  local status = response.StatusCode or response.status_code or response.status
  if type(status) ~= "number" or status < 200 or status >= 300 then
    fail()
  end

  local responseBody = response.Body or response.body
  if type(responseBody) ~= "string" or #responseBody == 0 then
    fail()
  end

  local ok, decoded = pcall(function()
    return HttpService:JSONDecode(responseBody)
  end)

  if not ok or type(decoded) ~= "table" then
    fail()
  end

  return decoded
end

local function isSha256Hex(value)
  return type(value) == "string"
    and #value == 64
    and string.match(value, "^[a-f0-9]+$") ~= nil
end

local function validateDelivery(delivery)
  if type(delivery) ~= "table" then
    fail()
  end

  if type(delivery.payload) ~= "string" or #delivery.payload == 0 then
    fail()
  end

  if delivery.payload_format_version ~= SUPPORTED_PAYLOAD_FORMAT_VERSION then
    fail()
  end

  if delivery.build_version ~= SUPPORTED_BUILD_VERSION then
    fail()
  end

  local context = delivery.context
  if type(context) ~= "table" then
    fail()
  end

  if type(context.build_id) ~= "string" or #context.build_id == 0 then
    fail()
  end

  if type(context.version_id) ~= "string" or #context.version_id == 0 then
    fail()
  end

  if not isSha256Hex(context.source_sha256) then
    fail()
  end

  if not isSha256Hex(context.payload_sha256) then
    fail()
  end

  return context
end

local function createRuntime()
  local Runtime = {
    version = RUNTIME_VERSION,
  }

  local function getAdapter()
    local adapter = _G.LuxyHubRuntimeAdapterV1
    if type(adapter) ~= "table" then
      fail()
    end

    if type(adapter.sha256) ~= "function"
      or type(adapter.decryptAes256Gcm) ~= "function"
      or type(adapter.gunzip) ~= "function" then
      fail()
    end

    return adapter
  end

  local function decodePayload(payload)
    local ok, envelope = pcall(function()
      return HttpService:JSONDecode(payload)
    end)

    if not ok or type(envelope) ~= "table" then
      fail()
    end

    if envelope.v ~= SUPPORTED_PAYLOAD_FORMAT_VERSION then
      fail()
    end

    if envelope.alg ~= SUPPORTED_ENCRYPTION_SCHEME then
      fail()
    end

    if envelope.compression ~= SUPPORTED_COMPRESSION then
      fail()
    end

    if type(envelope.kid) ~= "string"
      or type(envelope.iv) ~= "string"
      or type(envelope.tag) ~= "string"
      or type(envelope.data) ~= "string" then
      fail()
    end

    return envelope
  end

  function Runtime.buildAAD(delivery)
    local context = validateDelivery(delivery)
    return delivery.payload_format_version .. ":" .. context.version_id .. ":" .. context.source_sha256
  end

  function Runtime.consume(delivery)
    local context = validateDelivery(delivery)
    local aad = Runtime.buildAAD(delivery)

    if delivery.aad ~= aad then
      fail()
    end

    local adapter = getAdapter()
    if adapter.sha256(delivery.payload) ~= context.payload_sha256 then
      fail()
    end

    local envelope = decodePayload(delivery.payload)
    local compressed = adapter.decryptAes256Gcm({
      envelope = envelope,
      aad = aad,
    })

    if compressed == nil then
      fail()
    end

    local source = adapter.gunzip(compressed)
    if type(source) ~= "string" then
      fail()
    end

    if type(adapter.execute) == "function" then
      return adapter.execute(source)
    end

    local chunk = loadstring(source)
    if type(chunk) ~= "function" then
      fail()
    end

    return chunk()
  end

  return Runtime
end

if type(_G.LuxyHubLoaderRuntimeV1) ~= "table" then
  _G.LuxyHubLoaderRuntimeV1 = createRuntime()
end

local Runtime = _G.LuxyHubLoaderRuntimeV1
if type(Runtime) ~= "table" or Runtime.version ~= RUNTIME_VERSION or type(Runtime.consume) ~= "function" then
  fail()
end

local session = postJson("/api/delivery/session", {
  slug = LUXY_SLUG,
})

if type(session.session_token) ~= "string" or #session.session_token == 0 then
  fail()
end

local delivery = postJson("/api/delivery/fetch", {
  session_token = session.session_token,
})

local context = validateDelivery(delivery)
local aad = delivery.payload_format_version .. ":" .. context.version_id .. ":" .. context.source_sha256

return Runtime.consume({
  payload = delivery.payload,
  context = context,
  aad = aad,
  payload_format_version = delivery.payload_format_version,
  build_version = delivery.build_version,
  runtime_version = RUNTIME_VERSION,
})
`
}
