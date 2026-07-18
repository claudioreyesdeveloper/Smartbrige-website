import { z } from "zod"
import { JamError } from "@/lib/jam/domain/errors"

export const CREATIVE_PRIVATE_CONTRACT_HASH =
  "05e583863ae44c9d8f110fb6d8c7df9ba6982af1af020b83b2b658935c224145"

const opaqueId = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/)
const projectId = opaqueId
const option = z.object({ optionId: opaqueId, label: z.string().min(1).max(128) }).strict()
const timeSignature = z.object({
  numerator: z.number().int().min(1).max(32),
  denominator: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16)]),
}).strict()
const displayChord = z.object({
  symbol: z.string().min(1).max(32),
  startBar: z.number().finite().min(0).max(10_000),
  durationBars: z.number().finite().gt(0).max(256),
}).strict()
const playback = z.object({
  channel: z.number().int().min(1).max(16),
  kind: z.enum(["mega-voice", "dx7-bass1", "channel-current", "drum-kit"]),
  label: z.string().min(1).max(64),
  bankMsb: z.number().int().min(0).max(127).nullable(),
  bankLsb: z.number().int().min(0).max(127).nullable(),
  programYamaha: z.number().int().min(1).max(128).nullable(),
}).strict()

const standardBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const renderedSmf = z.string().min(4).max(Math.ceil((8 * 1024 * 1024) / 3) * 4)
  .superRefine((value, ctx) => {
    if (!standardBase64.test(value)) {
      ctx.addIssue({ code: "custom", message: "MIDI export is not canonical base64." })
      return
    }
    try {
      const decoded = atob(value)
      if (
        decoded.length < 14 ||
        decoded.length > 8 * 1024 * 1024 ||
        btoa(decoded) !== value ||
        decoded.slice(0, 4) !== "MThd"
      ) {
        ctx.addIssue({ code: "custom", message: "MIDI export is invalid or oversized." })
      }
    } catch {
      ctx.addIssue({ code: "custom", message: "MIDI export is invalid." })
    }
  })

export const soloOptionsPublicRequestSchema = z.object({ projectId }).strict()
export const soloOptionsEngineRequestSchema = z.object({
  subjectId: opaqueId,
  projectId,
}).strict()
export const soloOptionsResponseSchema = z.object({
  expiresAt: z.iso.datetime({ offset: true }),
  instruments: z.array(option).min(1).max(32),
  styles: z.array(option).min(1).max(128),
}).strict()

export const soloGeneratePublicRequestSchema = z.object({
  projectId,
  sectionId: opaqueId,
  contextRevision: opaqueId,
  model: z.enum(["genos", "genos2", "tyros4", "tyros5"]),
  optionsExpiresAt: z.iso.datetime({ offset: true }),
  instrumentOptionId: opaqueId,
  styleOptionId: opaqueId,
  feel: z.enum(["straight", "swing"]).optional(),
  takeCount: z.number().int().min(2).max(8),
}).strict()
const soloContext = z.object({
  sectionId: opaqueId,
  sectionName: z.string().min(1).max(64),
  bars: z.number().int().min(1).max(64),
  bpm: z.number().int().min(40).max(300),
  key: z.string().min(1).max(16),
  timeSignature,
  chords: z.array(displayChord).min(1).max(128),
  melody: z.array(z.object({
    beat: z.number().finite().min(0).max(1024),
    durationBeats: z.number().finite().gt(0).max(64),
    pitch: z.number().int().min(0).max(127),
  }).strict()).max(4096).optional(),
}).strict()
export const soloGenerateEngineRequestSchema = soloGeneratePublicRequestSchema
  .omit({ contextRevision: true, sectionId: true })
  .extend({ subjectId: opaqueId, context: soloContext })
  .strict()
export const soloGenerateResponseSchema = z.object({
  generationId: opaqueId,
  expiresAt: z.iso.datetime({ offset: true }),
  takes: z.array(z.object({
    takeId: opaqueId,
    label: z.string().min(1).max(64),
    durationMs: z.number().int().min(1).max(86_400_000),
  }).strict()).min(2).max(8),
}).strict()

export const soloRenderPublicRequestSchema = z.object({ projectId, takeId: opaqueId }).strict()
export const soloRenderEngineRequestSchema = z.object({
  subjectId: opaqueId,
  projectId,
  takeId: opaqueId,
}).strict()
export const soloRenderResponseSchema = z.object({
  renderId: opaqueId,
  recipeId: opaqueId,
  durationMs: z.number().int().min(1).max(86_400_000),
  renderedSmf,
  playback,
}).strict()

const creativeText = z.string().trim().max(2_000)
const lyricLine = z.object({
  phraseId: opaqueId,
  text: z.string().min(1).max(12_000),
}).strict()
const lyricCreative = z.object({
  title: creativeText.optional(),
  theme: creativeText.optional(),
  mood: creativeText.optional(),
  subject: creativeText.optional(),
  keywords: z.array(creativeText.min(1)).max(32).optional(),
  avoidWords: z.array(creativeText.min(1)).max(32).optional(),
  style: creativeText.optional(),
  language: z.literal("en"),
}).strict()
const lyricProsody = z.object({
  phrases: z.array(z.object({
    phraseId: opaqueId,
    sectionRole: z.enum(["verse", "pre", "chorus", "bridge", "intro", "outro"]),
    syllables: z.number().int().min(1).max(64),
    prominence: z.array(z.number().int().min(1).max(64)).max(64),
    sustain: z.array(z.number().int().min(1).max(64)).max(64),
    rhymeWithPhraseId: opaqueId.optional(),
    requiredHook: creativeText.optional(),
  }).strict()).min(1).max(128),
}).strict()

export const lyricGeneratePublicRequestSchema = z.object({
  projectId,
  creative: lyricCreative,
  prosody: lyricProsody,
}).strict()
export const lyricGenerateEngineRequestSchema = lyricGeneratePublicRequestSchema
  .extend({
    subjectId: opaqueId,
    entitlement: z.object({
      product: z.literal("lyrics"),
      grantId: opaqueId,
    }).strict(),
  })
  .omit({ projectId: true })
  .extend({ projectId })
  .strict()
export const lyricGenerateResponseSchema = z.object({
  generationId: opaqueId,
  lines: z.array(lyricLine).min(1).max(128),
}).strict()

const lyricNote = z.object({
  noteId: opaqueId,
  pitch: z.number().int().min(0).max(127),
  startTick: z.number().int().min(0).max(100_000_000),
  durationTicks: z.number().int().min(1).max(10_000_000),
  phraseId: opaqueId,
}).strict()
const lyricFitFields = {
  operation: z.enum(["fit", "remap"]),
  ppq: z.number().int().min(24).max(9_600),
  tempoBpm: z.number().int().min(20).max(400),
  key: z.string().min(1).max(16),
  timeSignature,
  chords: z.array(displayChord).max(512),
  notes: z.array(lyricNote).min(1).max(2_048),
  lines: z.array(lyricLine).min(1).max(128),
} as const
const lyricFitRefinement = <T extends {
  lines: Array<{ phraseId: string }>
  notes: Array<{ phraseId: string }>
}>(request: T, ctx: z.RefinementCtx) => {
  const phraseIds = new Set(request.lines.map((line) => line.phraseId))
  if (
    phraseIds.size !== request.lines.length ||
    request.notes.some((note) => !phraseIds.has(note.phraseId))
  ) {
    ctx.addIssue({ code: "custom", message: "Lyric phrase references are invalid." })
  }
}
export const lyricFitPublicRequestSchema = z.object({
  projectId,
  contextRevision: opaqueId,
  ...lyricFitFields,
}).strict().superRefine(lyricFitRefinement)
export const lyricFitEngineRequestSchema = z.object({
  subjectId: opaqueId,
  projectId,
  ...lyricFitFields,
}).strict().superRefine(lyricFitRefinement)
export const lyricFitResponseSchema = z.object({
  recipeReferenceId: opaqueId,
  renderReferenceId: opaqueId,
  phrases: z.array(z.object({
    phraseId: opaqueId,
    words: z.array(z.string().min(1).max(256)).max(256),
    syllables: z.array(z.string().min(1).max(256)).max(512),
    assignments: z.array(z.object({
      noteId: opaqueId,
      lyric: z.string().min(1).max(256),
    }).strict()).max(2_048),
  }).strict()).min(1).max(128),
  renderedExport: renderedSmf,
}).strict()

export function parseCreative<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new JamError("validation", "Request validation failed.")
  return result.data
}

export type SoloOptionsPublicRequest = z.infer<typeof soloOptionsPublicRequestSchema>
export type SoloOptionsResponse = z.infer<typeof soloOptionsResponseSchema>
export type SoloGeneratePublicRequest = z.infer<typeof soloGeneratePublicRequestSchema>
export type SoloGenerateEngineRequest = z.infer<typeof soloGenerateEngineRequestSchema>
export type SoloGenerateResponse = z.infer<typeof soloGenerateResponseSchema>
export type SoloRenderPublicRequest = z.infer<typeof soloRenderPublicRequestSchema>
export type SoloRenderResponse = z.infer<typeof soloRenderResponseSchema>
export type LyricGeneratePublicRequest = z.infer<typeof lyricGeneratePublicRequestSchema>
export type LyricGenerationResponse = z.infer<typeof lyricGenerateResponseSchema>
export type LyricFitPublicRequest = z.infer<typeof lyricFitPublicRequestSchema>
export type LyricFitResponse = z.infer<typeof lyricFitResponseSchema>
