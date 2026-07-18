"use client"

import { Check, MessageSquare, Send, Star, X } from "lucide-react"
import { useEffect, useState } from "react"

export function FeedbackPrompt({ meaningfulActions }: { meaningfulActions: number }) {
  const [elapsed, setElapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [email, setEmail] = useState("")
  const [notify, setNotify] = useState(false)
  const [website, setWebsite] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  useEffect(() => {
    const timer = window.setTimeout(() => setElapsed(true), 180000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (
      elapsed &&
      meaningfulActions >= 3 &&
      sessionStorage.getItem("smartbridge-demo-feedback") !== "closed"
    ) {
      setOpen(true)
    }
  }, [elapsed, meaningfulActions])

  const close = () => {
    sessionStorage.setItem("smartbridge-demo-feedback", "closed")
    setOpen(false)
  }

  const submit = async () => {
    if (!rating && !comment.trim() && !notify) return
    if (notify && !email.trim()) {
      setStatus("error")
      return
    }
    setStatus("sending")
    try {
      const response = await fetch("/api/demo-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment, email, notify, website }),
      })
      if (!response.ok) throw new Error("Feedback could not be delivered.")
      setStatus("sent")
      sessionStorage.setItem("smartbridge-demo-feedback", "closed")
    } catch {
      setStatus("error")
    }
  }

  if (!open) return null

  return (
    <aside className="feedback-prompt" aria-label="Demo feedback">
      <button className="feedback-close" type="button" onClick={close} aria-label="Close feedback">
        <X size={17} />
      </button>
      {status === "sent" ? (
        <div className="feedback-thanks">
          <span><Check size={22} /></span>
          <div><strong>Thank you.</strong><p>Your feedback went directly to the SmartBridge team.</p></div>
        </div>
      ) : (
        <>
          <span className="demo-eyebrow">You’ve tried the real workflow</span>
          <h2>Did you enjoy the demo?</h2>
          <div className="feedback-stars" aria-label="Rate this demo from one to five">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setRating(value)}
                className={value <= rating ? "is-active" : ""}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
              >
                <Star size={22} fill="currentColor" />
              </button>
            ))}
          </div>
          <label>
            <span><MessageSquare size={15} /> Leave a comment <small>optional</small></span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1200} placeholder="What surprised you? What should improve?" />
          </label>
          <label className="feedback-notify">
            <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
            <span>Notify me when SmartBridge is released</span>
          </label>
          {notify && (
            <label>
              <span>Email address</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" />
            </label>
          )}
          <input className="feedback-honeypot" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {notify && <p className="feedback-consent">By submitting, you agree to receive one release notification. You can opt out at any time.</p>}
          {status === "error" && <p className="feedback-error">Add a valid email for notifications, then try again.</p>}
          <button className="feedback-submit" type="button" onClick={submit} disabled={status === "sending"}>
            <Send size={16} /> {status === "sending" ? "Sending…" : "Send feedback"}
          </button>
        </>
      )}
    </aside>
  )
}
