"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, MessageSquareText, ThumbsUp } from "lucide-react"
import { FEATURE_STORIES } from "@/lib/feature-stories"

type PreviewItem = {
  id: string
  featureId: string
  type: string
  comment: string
  status: string
  votes: number
  replies: Array<{ id: string; body: string; authorName: string }>
}

const STATUS: Record<string, string> = {
  new: "New",
  under_review: "Under review",
  planned: "Planned",
  building: "Building",
  shipped: "Shipped",
  not_planned: "Not planned",
}

function nameFor(id: string) {
  return FEATURE_STORIES.find((story) => story.slug === id)?.title || id
}

export function CommunityPreview() {
  const [items, setItems] = useState<PreviewItem[]>([])

  useEffect(() => {
    let active = true
    fetch("/api/feedback", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (active) setItems(data.feedback || [])
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const featured = useMemo(
    () => items
      .filter((item) => item.comment?.trim())
      .sort((a, b) => {
        const activeA = ["building", "planned", "shipped"].includes(a.status) ? 1 : 0
        const activeB = ["building", "planned", "shipped"].includes(b.status) ? 1 : 0
        if (activeA !== activeB) return activeB - activeA
        return b.votes - a.votes
      })
      .slice(0, 3),
    [items],
  )

  if (featured.length === 0) {
    return (
      <div className="rounded-[1.6rem] border border-white/10 bg-white/[.04] p-7 text-white">
        <MessageSquareText size={26} className="text-[#c9f46a]" />
        <h3 className="mt-4 text-xl font-semibold">This board is waiting for the first product direction.</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
          Pick a feature, watch the current implementation, and tell me what should change. Suggestions,
          votes, my replies and development status will appear here publicly.
        </p>
        <Link href="/explore" className="m-button m-button-primary mt-5 inline-flex">
          Choose a feature to shape <ArrowRight size={15} />
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {featured.map((item) => (
        <Link
          key={item.id}
          href={`/explore/${item.featureId}`}
          className="block rounded-2xl border border-white/10 bg-white/[.04] p-5 transition hover:border-white/25"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <strong className="text-[#c9f46a]">{nameFor(item.featureId)}</strong>
            <span className="rounded-full bg-white/10 px-2 py-1 text-white/55">{STATUS[item.status] || item.status}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-white/35"><ThumbsUp size={12} /> {item.votes}</span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/70">{item.comment}</p>
          {item.replies[0] ? (
            <p className="mt-3 border-l-2 border-[#c9f46a] pl-3 text-xs leading-5 text-white/45">
              Claudio: {item.replies[0].body}
            </p>
          ) : null}
        </Link>
      ))}
      <Link href="/build-with-us" className="inline-flex items-center gap-2 text-sm font-semibold text-[#c9f46a]">
        See all community direction <ArrowRight size={14} />
      </Link>
    </div>
  )
}
