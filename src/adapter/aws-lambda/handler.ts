// @denoify-ignore
import crypto from 'crypto'
import type { Hono } from '../../hono'
import type { Env } from '../../types'

import { encodeBase64 } from '../../utils/encode'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.crypto ??= crypto

// When calling Lambda directly through function urls
interface APIGatewayProxyEventV2 {
  httpMethod: string
  headers: Record<string, string | undefined>
  rawPath: string
  rawQueryString: string
  body: string | null
  isBase64Encoded: boolean
  requestContext: {
    domainName: string
  }
}

// When calling Lambda through an API Gateway or an ELB
interface APIGatewayProxyEvent {
  httpMethod: string
  headers: Record<string, string | undefined>
  path: string
  body: string | null
  isBase64Encoded: boolean
  queryStringParameters?: Record<string, string | undefined>
  requestContext: {
    domainName: string
  }
}

// When calling Lambda through an Lambda Function URLs
interface LambdaFunctionUrlEvent {
  headers: Record<string, string | undefined>
  rawPath: string
  rawQueryString: string
  body: string | null
  isBase64Encoded: boolean
  requestContext: {
    domainName: string
    http: {
      method: string
    }
  }
}

interface APIGatewayProxyResult {
  statusCode: number
  body: string
  headers: Record<string, string>
  isBase64Encoded: boolean
}

/**
 * Accepts events from API Gateway/ELB(`APIGatewayProxyEvent`) and directly through Function Url(`APIGatewayProxyEventV2`)
 */
export const handle = <E extends Env = Env, S = {}, BasePath extends string = '/'>(app: Hono<E, S, BasePath>) => {
  return async (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | LambdaFunctionUrlEvent
  ): Promise<APIGatewayProxyResult> => {
    const req = createRequest(event)
    const res = await app.fetch(req)

    return createResult(res)
  }
}

const createResult = async (res: Response): Promise<APIGatewayProxyResult> => {
  const contentType = res.headers.get('content-type')
  const isBase64Encoded_contentType = contentType && isContentTypeBinary(contentType) ? true : false

  const contentEncoding = res.headers.get('content-encoding')
  const isBase64Encoded_contentEncoding = isContentCompressed(contentEncoding)

  const isBase64Encoded = isBase64Encoded_contentType || isBase64Encoded_contentEncoding

  let body: string
  if (isBase64Encoded) {
    const buffer = await res.arrayBuffer()
    body = encodeBase64(buffer)
  } else {
    body = await res.text()
  }
  const result: APIGatewayProxyResult = {
    body: body,
    headers: {},
    statusCode: res.status,
    isBase64Encoded,
  }

  res.headers.forEach((value, key) => {
    result.headers[key] = value
  })

  return result
}

const createRequest = (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | LambdaFunctionUrlEvent
) => {
  const queryString = extractQueryString(event)
  const urlPath = `https://${event.requestContext.domainName}${
    isProxyEvent(event) ? event.path : event.rawPath
  }`
  const url = queryString ? `${urlPath}?${queryString}` : urlPath

  const headers = new Headers()
  for (const [k, v] of Object.entries(event.headers)) {
    if (v) headers.set(k, v)
  }

  const method = 'httpMethod' in event ? event.httpMethod : event.requestContext.http.method
  const requestInit: RequestInit = {
    headers,
    method,
  }

  if (event.body) {
    requestInit.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body
  }

  return new Request(url, requestInit)
}

const extractQueryString = (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | LambdaFunctionUrlEvent
) => {
  if (isProxyEvent(event)) {
    return Object.entries(event.queryStringParameters || {})
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
  }

  return isProxyEventV2(event) ? event.rawQueryString : event.rawQueryString
}

const isProxyEvent = (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | LambdaFunctionUrlEvent
): event is APIGatewayProxyEvent => {
  return Object.prototype.hasOwnProperty.call(event, 'path')
}

const isProxyEventV2 = (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2 | LambdaFunctionUrlEvent
): event is APIGatewayProxyEventV2 => {
  return Object.prototype.hasOwnProperty.call(event, 'rawPath')
}

export const isContentTypeBinary = (contentType: string) => {
  return !/^(text\/(plain|html|css|javascript|csv).*|application\/(.*json|.*xml).*|image\/svg\+xml)$/.test(
    contentType
  )
}

export const isContentCompressed = (contentEncoding: string | null) => {
  if (contentEncoding === null) { return false }
  return /^(gzip|deflate|compress|br)/.test(contentEncoding)
}