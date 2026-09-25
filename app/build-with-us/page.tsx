import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, MessageSquareText, Milestone, Wrench } from "lucide-react"
import { CommunityBoard } from "@/components/community/community-board"

export const metadata: Metadata = {
  title: "Build with us",
  description: "Help direct SmartBridge development: tell me what matters, what is missing, and what should be improved next. No account required.",
}

export default function BuildWithUsPage() {
  return (
    <div className="marketing-page">
      <section className="border-b border-white/10 bg-[#0d0f0c] text-white">
        <div className="m-wrap grid gap-8 py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-end lg:py-24">
          <div>
            <p className="m-eyebrow">Build with us</p>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-instrument-serif)] text-5xl leading-[.96] md:text-7xl">
              I want your direction to help me build a better SmartBridge.
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-lg leading-8 text-white/65">
              SmartBridge is still evolving, and I do not want to decide its direction in isolation.
              I want musicians to tell me which problems are worth solving, which features are genuinely
              useful, what feels too difficult, and what would make the product better. That input will
              help me decide what to simplify, improve and build next. No account is required.
            </p>
            <Link href="/explore" className="m-button m-button-primary mt-6 inline-flex">
              Show me what matters to you <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap grid gap-4 md:grid-cols-3">
          {[
            [MessageSquareText, "Tell me what matters", "Watch the real feature, then tell me what helps, what gets in your way, and what would make it more useful in your musical workflow."],
            [Milestone, "Help set priorities", "Your input gives me evidence about what musicians actually need, so I can make better choices about what to simplify, improve or build next."],
            [Wrench, "See what your input changes", "I can reply publicly and move useful ideas through under review, planned, building and shipped so the development response stays visible."],
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
              The direction musicians are asking for — and how SmartBridge is responding.
            </h2>
          </div>
          <CommunityBoard />
        </div>
      </section>
    </div>
  )
}
