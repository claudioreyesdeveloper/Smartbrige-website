import { JamError } from "@/lib/jam/domain/errors"
import { stripForbiddenKeys } from "@/lib/jam/domain/forbidden"
import {
  parseJamPrepareResponse,
  parseJamReharmonizeResponse,
} from "@/lib/jam/domain/validate"
import type {
  JamPrepareEngineRequest,
  JamPrepareResponse,
  JamReharmonizeEngineRequest,
  JamReharmonizeResponse,
} from "@/lib/jam/domain/types"
import { readEngineProxyConfig, type EngineProxyConfig } from "@/lib/engine-proxy/env"
import { signEngineRequest } from "@/lib/engine-proxy/hmac"
import {
  parseRhythmFillsResponse,
  parseRhythmOptionsResponse,
  parseRhythmQueryResponse,
  parseRhythmRenderResponse,
  type RhythmFillsEngineRequest,
  type RhythmFillsResponse,
  type RhythmOptionsEngineRequest,
  type RhythmOptionsResponse,
  type RhythmQueryEngineRequest,
  type RhythmQueryResponse,
  type RhythmRenderEngineRequest,
  type RhythmRenderResponse,
} from "@/lib/rhythm/domain"
import {
  lyricFitEngineRequestSchema,
  lyricFitResponseSchema,
  lyricGenerateEngineRequestSchema,
  lyricGenerateResponseSchema,
  soloGenerateEngineRequestSchema,
  soloGenerateResponseSchema,
  soloOptionsEngineRequestSchema,
  soloOptionsResponseSchema,
  soloRenderEngineRequestSchema,
  soloRenderResponseSchema,
  type LyricFitResponse,
  type LyricGenerationResponse,
  type SoloGenerateEngineRequest,
  type SoloGenerateResponse,
  type SoloOptionsResponse,
  type SoloRenderResponse,
} from "@/lib/creative/contracts"
import { z } from "zod"

const ALLOWED_ENGINE_PATHS = {
  prepare: "/v1/jam/prepare",
  reharmonize: "/v1/jam/reharmonize",
  rhythmOptions: "/v1/rhythm/options",
  rhythmQuery: "/v1/rhythm/query",
  rhythmFills: "/v1/rhythm/fills",
  rhythmRender: "/v1/rhythm/render",
  soloOptions: "/v1/solo/options",
  soloGenerate: "/v1/solo/generate",
  soloRender: "/v1/solo/render",
  lyricGenerate: "/v1/lyrics/generate",
  lyricFit: "/v1/lyrics/fit",
} as const

export const ENGINE_REQUEST_TIMEOUT_MS = 15_000
export const ENGINE_REQUEST_MAX_ATTEMPTS = 1

export type EngineFetch = typeof fetch

export type EngineClientDependencies = {
  config?: EngineProxyConfig
  fetchImpl?: EngineFetch
  nowMs?: () => number
}

function joinEngineUrl(baseUrl: URL, path: string): URL {
  // Fixed path only — never accept caller-controlled absolute URLs (open proxy / SSRF).
  const url = new URL(baseUrl.toString())
  const basePath = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")
  url.pathname = `${basePath}${path}`
  url.search = ""
  url.hash = ""
  return url
}

function assertSameOrigin(requestUrl: URL, configured: URL): void {
  if (
    requestUrl.protocol !== configured.protocol ||
    requestUrl.host !== configured.host
  ) {
    throw new JamError("internal", "Engine request target rejected.")
  }
}

async function postEngineJson<TResponse>(options: {
  path: (typeof ALLOWED_ENGINE_PATHS)[keyof typeof ALLOWED_ENGINE_PATHS]
  body: unknown
  parseResponse: (value: unknown) => TResponse
  config: EngineProxyConfig
  fetchImpl: EngineFetch
  nowMs: () => number
  timeoutMs?: number
}): Promise<TResponse> {
  const rawBody = JSON.stringify(options.body)
  const target = joinEngineUrl(options.config.baseUrl, options.path)
  assertSameOrigin(target, options.config.baseUrl)

  let response: Response
  try {
    const headers = signEngineRequest({
      rawBody,
      secret: options.config.signingSecret,
      nowMs: options.nowMs(),
    })
    response = await options.fetchImpl(target.toString(), {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? ENGINE_REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
  }

  if (response.status >= 300 && response.status < 400) {
    throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
  }

  const text = await response.text()
  let json: unknown
  try {
    json = text.trim() ? JSON.parse(text) : null
  } catch {
    throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
  }

  if (!response.ok) {
    // Abuse-safe: do not forward private error details or stack traces.
    if (response.status === 401 || response.status === 403) {
      throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
    }
    if (response.status === 413) {
      throw new JamError("payload_too_large", "Request body is too large.")
    }
    if (response.status === 400) {
      throw new JamError("validation", "Request validation failed.")
    }
    if (response.status === 501) {
      throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
    }
    throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
  }

  const sanitized = stripForbiddenKeys(json)
  try {
    return options.parseResponse(sanitized)
  } catch (error) {
    if (error instanceof JamError) throw error
    throw new JamError("unavailable", "The jam engine is temporarily unavailable.")
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new JamError("unavailable", "The creative service is temporarily unavailable.")
  return parsed.data
}

export class PrivateEngineClient {
  private readonly config: EngineProxyConfig
  private readonly fetchImpl: EngineFetch
  private readonly nowMs: () => number

  constructor(deps: EngineClientDependencies = {}) {
    this.config = deps.config ?? readEngineProxyConfig()
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.nowMs = deps.nowMs ?? Date.now
  }

  prepare(request: JamPrepareEngineRequest): Promise<JamPrepareResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.prepare,
      body: request,
      parseResponse: parseJamPrepareResponse,
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  reharmonize(request: JamReharmonizeEngineRequest): Promise<JamReharmonizeResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.reharmonize,
      body: request,
      parseResponse: parseJamReharmonizeResponse,
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  rhythmOptions(request: RhythmOptionsEngineRequest): Promise<RhythmOptionsResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.rhythmOptions,
      body: request,
      parseResponse: parseRhythmOptionsResponse,
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  rhythmQuery(request: RhythmQueryEngineRequest): Promise<RhythmQueryResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.rhythmQuery,
      body: request,
      parseResponse: parseRhythmQueryResponse,
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  rhythmFills(request: RhythmFillsEngineRequest): Promise<RhythmFillsResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.rhythmFills,
      body: request,
      parseResponse: parseRhythmFillsResponse,
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  rhythmRender(request: RhythmRenderEngineRequest): Promise<RhythmRenderResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.rhythmRender,
      body: request,
      parseResponse: parseRhythmRenderResponse,
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  soloOptions(request: z.infer<typeof soloOptionsEngineRequestSchema>): Promise<SoloOptionsResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.soloOptions,
      body: soloOptionsEngineRequestSchema.parse(request),
      parseResponse: (value) => parseWithSchema(soloOptionsResponseSchema, value),
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  soloGenerate(request: SoloGenerateEngineRequest): Promise<SoloGenerateResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.soloGenerate,
      body: soloGenerateEngineRequestSchema.parse(request),
      parseResponse: (value) => parseWithSchema(soloGenerateResponseSchema, value),
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  soloRender(request: z.infer<typeof soloRenderEngineRequestSchema>): Promise<SoloRenderResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.soloRender,
      body: soloRenderEngineRequestSchema.parse(request),
      parseResponse: (value) => parseWithSchema(soloRenderResponseSchema, value),
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  lyricGenerate(
    request: z.infer<typeof lyricGenerateEngineRequestSchema>,
  ): Promise<LyricGenerationResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.lyricGenerate,
      body: lyricGenerateEngineRequestSchema.parse(request),
      parseResponse: (value) => parseWithSchema(lyricGenerateResponseSchema, value),
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }

  lyricFit(request: z.infer<typeof lyricFitEngineRequestSchema>): Promise<LyricFitResponse> {
    return postEngineJson({
      path: ALLOWED_ENGINE_PATHS.lyricFit,
      body: lyricFitEngineRequestSchema.parse(request),
      parseResponse: (value) => parseWithSchema(lyricFitResponseSchema, value),
      config: this.config,
      fetchImpl: this.fetchImpl,
      nowMs: this.nowMs,
    })
  }
}
