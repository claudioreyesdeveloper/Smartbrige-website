"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Clock3, MessageSquareText, Play, Send, ThumbsUp } from "lucide-react"

type Reply = {
  id: string
  body: string
  authorName: string
  createdAt: string
}

type FeedbackItem = {
  id: string
  type: "feedback" | "suggestion" | "problem"
  pulse: "yes" | "maybe" | "no" | null
  comment: string
  displayName: string
  videoSeconds: number | null
  status: string
  createdAt: string
  votes: number
  replies: Reply[]
}

type YTPlayer = {
  getCurrentTime(): number
  destroy(): void
}

type YTNamespace = {
  Player: new (
    elementId: string,
    options: {
      videoId: string
      playerVars?: Record<string, number>
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
  }
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  under_review: "Under review",
  planned: "Planned",
  building: "Building",
  shipped: "Shipped",
  not_planned: "Not planned",
}

function formatVideoTime(seconds: number | null) {
  if (seconds == null) return null
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export function FeatureConversation({
  featureId,
  featureTitle,
  youtubeId,
  videoTitle,
  videoDuration,
}: {
  featureId: string
  featureTitle: string
  youtubeId: string
  videoTitle: string
  videoDuration: string
}) {
  const playerRef = useRef<YTPlayer | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pulse, setPulse] = useState<"yes" | "maybe" | "no" | null>(null)
  const [type, setType] = useState<"feedback" | "suggestion" | "problem">("feedback")
  const [comment, setComment] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [notify, setNotify] = useState(false)
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [videoSeconds, setVideoSeconds] = useState<number | null>(null)
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/feedback?feature=${encodeURIComponent(featureId)}`, {
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load feedback.")
      setItems(data.feedback || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [featureId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const elementId = `sb-feature-video-${featureId}`

    const createPlayer = () => {
      if (!window.YT?.Player || playerRef.current) return false
      playerRef.current = new window.YT.Player(elementId, {
        videoId: youtubeId,
        playerVars: { rel: 0 },
      })
      setPlayerReady(true)
      return true
    }

    if (createPlayer()) return

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      script.async = true
      document.head.appendChild(script)
    }

    const interval = window.setInterval(() => {
      if (createPlayer()) window.clearInterval(interval)
    }, 250)

    const timeout = window.setTimeout(() => window.clearInterval(interval), 10000)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [featureId, youtubeId])

  const captureMoment = () => {
    if (!playerRef.current) return
    setVideoSeconds(Math.max(0, Math.round(playerRef.current.getCurrentTime())))
  }

  const submit = async () => {
    if (!pulse && !comment.trim()) return
    if (notify && !email.trim()) {
      setStatus("error")
      setError("Add an email address if you want reply notifications.")
      return
    }

    setStatus("sending")
    setError("")
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          featureId,
          type,
          pulse,
          comment,
          displayName,
          notify,
          email,
          videoSeconds,
          website,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not post feedback.")

      setStatus("sent")
      setComment("")
      setPulse(null)
      setVideoSeconds(null)
      await load()
    } catch (caught) {
      setStatus("error")
      setError(caught instanceof Error ? caught.message : "Could not post feedback.")
    }
  }

  const vote = async (id: string) => {
    const response = await fetch(`/api/feedback/${encodeURIComponent(id)}/vote`, {
      method: "POST",
    })
    if (response.ok) await load()
  }

  const discussionCount = useMemo(
    () => items.filter((item) => item.comment.trim()).length,
    [items],
  )

  return (
    <div className="grid gap-8 xl:grid-cols-[1.18fr_.82fr]">
      <div>
        <div className="overflow-hidden rounded-[1.6rem] bg-black shadow-[0_24px_80px_rgba(15,18,13,.18)]">
          <div className="aspect-video w-full" id={`sb-feature-video-${featureId}`} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-black/50">
          <span className="inline-flex items-center gap-2">
            <Play size={14} /> {videoTitle} · {videoDuration}
          </span>
          <span>Current walkthrough</span>
        </div>
      </div>

      <aside className="rounded-[1.6rem] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(20,24,18,.06)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-black/45">Help shape {featureTitle}</p>
        <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-3xl text-[#151712]">
          What should I improve next?
        </h2>

        <div className="mt-6">
          <p className="text-sm font-semibold text-black/70">Would you use this?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["yes", "Yes"],
              ["maybe", "Maybe"],
              ["no", "Not for me"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPulse(value as "yes" | "maybe" | "no")}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  pulse === value
                    ? "border-[#151712] bg-[#151712] text-white"
                    : "border-black/10 bg-[#f4f3ed] text-black/60 hover:border-black/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-black/70">What do you want to tell me?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["feedback", "Feedback"],
              ["suggestion", "Suggestion"],
              ["problem", "Problem"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value as "feedback" | "suggestion" | "problem")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  type === value
                    ? "border-[#667d25] bg-[#dff2a9] text-[#344016]"
                    : "border-black/10 text-black/50 hover:border-black/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-black/70">Your comment</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="What would make this feature more useful to you?"
            className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-[#faf9f5] px-4 py-3 text-sm text-[#151712] outline-none transition placeholder:text-black/30 focus:border-black/35"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={captureMoment}
            disabled={!playerReady}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-black/55 transition hover:border-black/25 disabled:opacity-35"
          >
            <Clock3 size={14} />
            {videoSeconds == null ? "Comment on this video moment" : `Attached at ${formatVideoTime(videoSeconds)}`}
          </button>
          {videoSeconds != null ? (
            <button type="button" onClick={() => setVideoSeconds(null)} className="text-xs text-black/40 underline">
              Remove timestamp
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-black/55">
            Name <span className="font-normal text-black/35">optional</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              placeholder="Anonymous"
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#faf9f5] px-3 py-2.5 text-sm font-normal text-[#151712] outline-none focus:border-black/35"
            />
          </label>
          <label className="flex items-start gap-2.5 pt-5 text-xs text-black/55">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              className="mt-0.5"
            />
            Email me when Claudio replies
          </label>
        </div>

        {notify ? (
          <label className="mt-3 block text-xs font-semibold text-black/55">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#faf9f5] px-3 py-2.5 text-sm font-normal text-[#151712] outline-none focus:border-black/35"
            />
          </label>
        ) : null}

        <input
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        {status === "error" ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {status === "sent" ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#52651f]">
            <Check size={16} /> Posted. Thank you.
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={status === "sending" || (!pulse && !comment.trim())}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#151712] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={15} /> {status === "sending" ? "Posting…" : "Post feedback"}
        </button>
      </aside>

      <section className="xl:col-span-2">
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-black/40">Community feedback</p>
            <h2 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl text-[#151712]">
              {discussionCount} public {discussionCount === 1 ? "comment" : "comments"}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-black/45">
            Suggestions can be voted on without an account. Status changes and Claudio&apos;s replies stay attached to the original feature.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {loading ? (
            <p className="py-8 text-sm text-black/40">Loading discussion…</p>
          ) : items.filter((item) => item.comment.trim()).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-8 text-center">
              <MessageSquareText className="mx-auto text-black/25" size={28} />
              <p className="mt-3 font-medium text-black/60">No public comments yet.</p>
              <p className="mt-1 text-sm text-black/40">Be the first person to leave feedback on this feature.</p>
            </div>
          ) : (
            items
              .filter((item) => item.comment.trim())
              .map((item) => (
                <article key={item.id} className="rounded-2xl border border-black/10 bg-white p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#ecebe4] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-black/55">
                          {item.type}
                        </span>
                        <span className="rounded-full bg-[#dff2a9] px-2.5 py-1 text-[11px] font-semibold text-[#43521d]">
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                        {item.videoSeconds != null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-black/45">
                            <Clock3 size={12} /> {formatVideoTime(item.videoSeconds)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-base leading-7 text-black/75">{item.comment}</p>
                      <p className="mt-3 text-xs text-black/40">
                        {item.displayName || "Anonymous"} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void vote(item.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-black/55 transition hover:border-black/25"
                    >
                      <ThumbsUp size={14} /> {item.votes}
                    </button>
                  </div>

                  {item.replies.map((reply) => (
                    <div key={reply.id} className="mt-5 rounded-xl border-l-4 border-[#c9f46a] bg-[#151712] p-4 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">{reply.authorName} · SmartBridge</strong>
                        <span className="text-xs text-white/35">{formatDate(reply.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/70">{reply.body}</p>
                    </div>
                  ))}
                </article>
              ))
          )}
        </div>
      </section>
    </div>
  )
}
