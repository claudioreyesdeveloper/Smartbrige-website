import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, MessageSquareText, Milestone, Wrench } from "lucide-react"
import { CommunityBoard } from "@/components/community/community-board"

export const metadata: Metadata = {
  title: "Build with us",
  description: "Public SmartBridge feature feedback, developer replies and development status. No account required.",
}

export default function BuildWithUsPage() {
  return (
    <div className="marketing-page">
      <section className="border-b border-white/10 bg-[#0d0f0c] text-white">
        <div className="m-wrap grid gap-8 py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-end lg:py-24">
          <div>
            <p className="m-eyebrow">Build with us</p>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-instrument-serif)] text-5xl leading-[.96] md:text-7xl">
              SmartBridge development should be a conversation.
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-lg leading-8 text-white/65">
              Watch a feature, tell me what works or what is missing, and follow the response from
              suggestion to development status. No account is required to comment or vote.
            </p>
            <Link href="/explore" className="m-button m-button-primary mt-6 inline-flex">
              Choose a feature <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap grid gap-4 md:grid-cols-3">
          {[
            [MessageSquareText, "Discuss the real feature", "Feedback lives on the same page as the current video and workflow, so the context is never lost."],
            [Milestone, "See what happens next", "Suggestions carry a visible status: under review, planned, building, shipped or not planned."],
            [Wrench, "Close the development loop", "Developer replies remain public and shipped changes stay linked to the original request."],
          ].map(([Icon, title, body]) => {
            const Component = Icon as typeof MessageSquareText
            return (
              <article key={String(title)} className="rounded-2xl border border-black/10 p-6">
                <Component size={22} className="text-[#667d25]" />
                <h2 className="mt-4 text-lg font-semibold text-[#151712]">{String(title)}</h2>
                <p className="mt-2 text-sm leading-6 text-black/50">{String(body)}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="m-section bg-[#f3f2ec]">
        <div className="m-wrap">
          <div className="mb-8 max-w-3xl">
            <p className="m-eyebrow">Public feedback</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712] md:text-5xl">
              What musicians are asking for — and what SmartBridge is doing about it.
            </h2>
          </div>
          <CommunityBoard />
        </div>
      </section>
    </div>
  )
}
