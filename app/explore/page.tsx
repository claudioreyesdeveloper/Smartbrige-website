import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MessageSquareText, PlayCircle } from "lucide-react"
import { FEATURE_GROUPS, FEATURE_STORIES } from "@/lib/feature-stories"

export const metadata: Metadata = {
  title: "Explore SmartBridge",
  description: "Watch the current SmartBridge workflows, understand what each feature does, and give direct feedback without creating an account.",
}

const groupCopy = {
  Create: "Define, capture and develop the song itself.",
  Arrange: "Turn the song into performed instrumental and vocal material.",
  Connect: "Keep the Yamaha hardware and production environment working as one system.",
}

export default function ExplorePage() {
  return (
    <div className="marketing-page">
      <section className="m-section border-b border-white/10 bg-[#0d0f0c]">
        <div className="m-wrap grid gap-8 py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-end lg:py-24">
          <div>
            <p className="m-eyebrow">Explore SmartBridge</p>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-instrument-serif)] text-5xl leading-[.96] text-white md:text-7xl">
              See the feature. Understand the workflow. Help shape what comes next.
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-lg leading-8 text-white/65">
              SmartBridge is organised around musical outcomes rather than a catalogue of small tools.
              Every feature page contains a current walkthrough, the real workflow behind it, and a
              public discussion where you can leave feedback or suggestions without signing in.
            </p>
            <Link href="/build-with-us" className="m-button m-button-primary mt-6 inline-flex">
              See community feedback <MessageSquareText size={17} />
            </Link>
          </div>
        </div>
      </section>

      {FEATURE_GROUPS.map((group) => {
        const stories = FEATURE_STORIES.filter((story) => story.group === group)
        return (
          <section className="m-section" key={group}>
            <div className="m-wrap">
              <div className="mb-8 grid gap-3 border-b border-black/10 pb-6 md:grid-cols-[220px_1fr]">
                <p className="m-eyebrow">{group}</p>
                <div>
                  <h2 className="font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712]">
                    {groupCopy[group]}
                  </h2>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {stories.map((story) => (
                  <article
                    key={story.slug}
                    className="group overflow-hidden rounded-[1.6rem] border border-black/10 bg-white shadow-[0_20px_60px_rgba(20,24,18,.06)]"
                  >
                    <Link href={`/explore/${story.slug}`} className="block overflow-hidden bg-[#121510]">
                      <Image
                        src={story.image}
                        alt={story.title}
                        width={1200}
                        height={760}
                        className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                      />
                    </Link>
                    <div className="p-6 md:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[.18em] text-black/45">{story.eyebrow}</span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-black/45">
                          <PlayCircle size={14} /> {story.video.duration}
                        </span>
                      </div>
                      <h3 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-3xl text-[#151712]">{story.title}</h3>
                      <p className="mt-3 max-w-2xl leading-7 text-black/60">{story.summary}</p>
                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        <Link href={`/explore/${story.slug}`} className="m-button m-button-ink">
                          Explore {story.title} <ArrowRight size={16} />
                        </Link>
                        <span className="inline-flex items-center gap-1.5 text-sm text-black/45">
                          <MessageSquareText size={15} /> Feedback enabled
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
