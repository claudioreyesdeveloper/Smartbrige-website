import { NextResponse } from "next/server"

export const runtime = "nodejs"

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5

function rateLimited(key: string) {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > MAX_REQUESTS
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maxLength)
    : ""
}

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const key = forwarded || request.headers.get("x-real-ip") || "anonymous"
  if (rateLimited(key)) {
    return NextResponse.json({ error: "Too many submissions." }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true })
  }

  const rating = Number(body.rating || 0)
  const comment = clean(body.comment, 1200)
  const email = clean(body.email, 254).toLowerCase()
  const notify = body.notify === true
  const validRating = Number.isInteger(rating) && rating >= 0 && rating <= 5
  const validEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!validRating || !validEmail || (notify && !email) || (!rating && !comment && !notify)) {
    return NextResponse.json({ error: "Invalid feedback submission." }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const recipient = process.env.DEMO_FEEDBACK_TO
  const sender = process.env.DEMO_FEEDBACK_FROM || "SmartBridge Demo <demo@thesmartbridge.io>"
  if (!apiKey || !recipient) {
    return NextResponse.json(
      { error: "Feedback email delivery is not configured." },
      { status: 503 },
    )
  }

  const lines = [
    `Rating: ${rating || "not provided"}/5`,
    `Release notification: ${notify ? "yes" : "no"}`,
    `Email: ${email || "not provided"}`,
    "",
    "Comment:",
    comment || "No comment provided.",
  ]

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: `SmartBridge demo feedback${rating ? ` — ${rating}/5` : ""}`,
      text: lines.join("\n"),
      reply_to: email || undefined,
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: "Email delivery failed." }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
