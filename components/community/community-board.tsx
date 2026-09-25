"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, Clock3, MessageSquareText, ThumbsUp } from "lucide-react"
import { FEATURE_STORIES } from "@/lib/feature-stories"

type Item = {
  id: string
  featureId: string
  type: string
  pulse: string | null
  comment: string
  displayName: string
  videoSeconds: number | null
  status: string
  createdAt: string
  votes: number
  replies: Array<{ id: string; body: string; authorName: string; createdAt: string }>
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  under_review: "Under review",
  planned: "Planned",
  building: "Building",
  shipped: "Shipped",
  not_planned: "Not planned",
}

function featureName(id: string) {
  return FEATURE_STORIES.find((story) => story.slug === id)?.title || id
}

function videoTime(seconds: number | null) {
  if (seconds == null) return null
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export function CommunityBoard() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/feedback", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load community feedback.")
      setItems(data.feedback || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const publicItems = useMemo(() => items.filter((item) => item.comment.trim()), [items])
  const filtered = filter === "all"
    ? publicItems
    : publicItems.filter((item) => item.status === filter)

  const counts = useMemo(() => {
    const result = { yes: 0, maybe: 0, no: 0 }
    for (const item of items) {
      if (item.pulse === "yes") result.yes += 1
      if (item.pulse === "maybe") result.maybe += 1
      if (item.pulse === "no") result.no += 1
    }
    return result
  }, [items])

  const vote = async (id: string) => {
    const response = await fetch(`/api/feedback/${encodeURIComponent(id)}/vote`, { method: "POST" })
    if (response.ok) await load()
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Yes", counts.yes, "Would use SmartBridge features shown"],
          ["Maybe", counts.maybe, "Interested but still need something"],
          ["Not for me", counts.no, "Useful signal about product fit"],
        ].map(([label, count, copy]) => (
          <div key={String(label)} className="rounded-2xl border border-black/10 bg-white p-5">
            <strong className="text-3xl text-[#151712]">{String(count)}</strong>
            <p className="mt-1 font-semibold text-[#151712]">{String(label)}</p>
            <p className="mt-1 text-sm text-black/45">{String(copy)}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        {[
          ["all", "All feedback"],
          ["under_review", "Under review"],
          ["planned", "Planned"],
          ["building", "Building"],
          ["shipped", "Shipped"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              filter === value
                ? "border-[#151712] bg-[#151712] text-white"
                : "border-black/10 bg-white text-black/55 hover:border-black/25"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {loading ? (
          <p className="py-10 text-black/40">Loading community feedback…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-10 text-center">
            <MessageSquareText className="mx-auto text-black/25" size={30} />
            <p className="mt-3 font-medium text-black/60">Nothing in this view yet.</p>
            <p className="mt-1 text-sm text-black/40">Feature discussions will appear here as musicians post feedback.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/explore/${item.featureId}`}
                      className="font-semibold text-[#151712] underline decoration-black/15 underline-offset-4 hover:decoration-black/50"
                    >
                      {featureName(item.featureId)}
                    </Link>
                    <span className="rounded-full bg-[#ecebe4] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.1em] text-black/50">
                      {item.type}
                    </span>
                    <span className="rounded-full bg-[#dff2a9] px-2.5 py-1 text-[11px] font-semibold text-[#43521d]">
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    {item.videoSeconds != null ? (
                      <span className="inline-flex items-center gap-1 text-xs text-black/40">
                        <Clock3 size={12} /> {videoTime(item.videoSeconds)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 max-w-4xl text-base leading-7 text-black/70">{item.comment}</p>
                  <p className="mt-3 text-xs text-black/35">{item.displayName || "Anonymous"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void vote(item.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-black/55 hover:border-black/25"
                >
                  <ThumbsUp size={14} /> {item.votes}
                </button>
              </div>

              {item.replies.map((reply) => (
                <div key={reply.id} className="mt-5 rounded-xl border-l-4 border-[#c9f46a] bg-[#151712] p-4 text-white">
                  <strong className="text-sm">{reply.authorName} · SmartBridge</strong>
                  <p className="mt-2 text-sm leading-6 text-white/70">{reply.body}</p>
                </div>
              ))}

              <Link href={`/explore/${item.featureId}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#52651f]">
                Join this feature discussion <ArrowRight size={14} />
              </Link>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
