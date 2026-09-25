"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FEATURE_STORIES } from "@/lib/feature-stories"

type AdminItem = {
  id: string
  featureId: string
  type: string
  pulse: string | null
  comment: string
  displayName: string
  email: string | null
  notifyOnReply: number
  videoSeconds: number | null
  status: string
  isHidden: number
  createdAt: string
  votes: number
  replies: Array<{ id: string; body: string; authorName: string; createdAt: string }>
}

const STATUSES = [
  ["new", "New"],
  ["under_review", "Under review"],
  ["planned", "Planned"],
  ["building", "Building"],
  ["shipped", "Shipped"],
  ["not_planned", "Not planned"],
]

function featureName(id: string) {
  return FEATURE_STORIES.find((story) => story.slug === id)?.title || id
}

export function FeedbackAdmin() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState("")
  const [loginBusy, setLoginBusy] = useState(false)
  const [items, setItems] = useState<AdminItem[]>([])
  const [filter, setFilter] = useState("all")
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/feedback", { cache: "no-store" })
      if (response.status === 401) {
        setAuthed(false)
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load feedback")
      setItems(data.feedback || [])
      setAuthed(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load feedback")
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoginBusy(true)
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Login failed")
      setPassword("")
      setAuthed(true)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoginBusy(false)
    }
  }

  const update = async (id: string, changes: { status?: string; isHidden?: boolean }) => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Update failed")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    } finally {
      setBusyId(null)
    }
  }

  const reply = async (id: string) => {
    const value = replyDrafts[id]?.trim()
    if (!value) return
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reply: value }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Reply failed")
      setReplyDrafts((current) => ({ ...current, [id]: "" }))
      toast.success("Reply published")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reply failed")
    } finally {
      setBusyId(null)
    }
  }

  const visible = useMemo(
    () => filter === "all" ? items : items.filter((item) => item.status === filter),
    [filter, items],
  )

  if (checking) {
    return <div className="content-wrap page-shell py-16 text-slate-400">Checking admin session…</div>
  }

  if (!authed) {
    return (
      <div className="content-wrap page-shell flex min-h-[60vh] items-center justify-center py-16">
        <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-black/50 p-8">
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl text-slate-50">Feedback admin</h1>
          <p className="text-sm text-slate-400">Use the existing SmartBridge admin password.</p>
          <Input type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" className="w-full" disabled={loginBusy || !password}>
            {loginBusy ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="content-wrap page-shell space-y-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ux-section-label">Admin · Community</p>
          <h1 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-4xl text-slate-50">Feature feedback</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Reply publicly, change development status, or hide a post. Email stays private and is shown here only when a commenter requested reply notifications.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin"><Button type="button" variant="outline">Style Maker users</Button></Link>
          <Button type="button" variant="outline" onClick={() => void load()}>Refresh</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[["all", "All"], ...STATUSES].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === value ? "border-lime-300/60 bg-lime-300/10 text-lime-200" : "border-white/10 text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5">
        {visible.map((item) => (
          <article key={item.id} className={`rounded-2xl border p-5 ${item.isHidden ? "border-red-500/20 bg-red-950/10" : "border-white/10 bg-white/[.03]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link href={`/explore/${item.featureId}`} className="font-semibold text-lime-200 hover:underline">
                    {featureName(item.featureId)}
                  </Link>
                  <span className="rounded-full bg-white/5 px-2 py-1 uppercase tracking-wider text-slate-400">{item.type}</span>
                  <span className="text-slate-500">{item.votes} votes</span>
                  {item.pulse ? <span className="text-slate-500">Would use: {item.pulse}</span> : null}
                  {item.videoSeconds != null ? <span className="text-slate-500">Video: {Math.floor(item.videoSeconds / 60)}:{String(item.videoSeconds % 60).padStart(2, "0")}</span> : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{item.comment || "Pulse response only."}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {item.displayName || "Anonymous"}
                  {item.email ? ` · ${item.email}${item.notifyOnReply ? " · notify on reply" : ""}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={item.status}
                  onChange={(event) => void update(item.id, { status: event.target.value })}
                  disabled={busyId === item.id}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-200"
                >
                  {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => void update(item.id, { isHidden: !Boolean(item.isHidden) })}
                >
                  {item.isHidden ? "Unhide" : "Hide"}
                </Button>
              </div>
            </div>

            {item.replies.length > 0 ? (
              <div className="mt-5 grid gap-2">
                {item.replies.map((entry) => (
                  <div key={entry.id} className="rounded-xl border-l-2 border-lime-300/60 bg-black/20 p-3 text-sm text-slate-300">
                    <strong className="text-slate-100">{entry.authorName}</strong>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{entry.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              <textarea
                value={replyDrafts[item.id] || ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                rows={2}
                placeholder="Write a public reply…"
                className="min-h-[44px] flex-1 resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <Button
                type="button"
                disabled={busyId === item.id || !(replyDrafts[item.id] || "").trim()}
                onClick={() => void reply(item.id)}
              >
                Reply
              </Button>
            </div>
          </article>
        ))}

        {visible.length === 0 ? <p className="py-8 text-slate-500">No feedback in this view.</p> : null}
      </div>
    </div>
  )
}
