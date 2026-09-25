import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"
import { FeatureConversation } from "@/components/community/feature-conversation"
import { FEATURE_STORIES, getFeatureStory } from "@/lib/feature-stories"

export function generateStaticParams() {
  return FEATURE_STORIES.map((story) => ({ slug: story.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const story = getFeatureStory(slug)
  if (!story) return {}
  return {
    title: story.title,
    description: story.summary,
  }
}

export default async function FeatureStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const story = getFeatureStory(slug)
  if (!story) notFound()

  return (
    <div className="marketing-page">
      <section className="border-b border-white/10 bg-[#0d0f0c] text-white">
        <div className="m-wrap py-12 md:py-20">
          <Link href="/explore" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
            <ArrowLeft size={15} /> Back to Explore
          </Link>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <p className="m-eyebrow">{story.group} · {story.eyebrow}</p>
              <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-instrument-serif)] text-5xl leading-[.95] md:text-7xl">
                {story.title}
              </h1>
              <p className="mt-5 max-w-3xl text-xl leading-8 text-white/70">{story.summary}</p>
            </div>
            <p className="max-w-xl text-base leading-7 text-white/55 lg:justify-self-end">
              {story.description}
            </p>
          </div>
        </div>
      </section>

      <section className="m-section bg-[#f3f2ec]">
        <div className="m-wrap">
          <FeatureConversation
            featureId={story.slug}
            featureTitle={story.title}
            youtubeId={story.video.youtubeId}
            videoTitle={story.video.title}
            videoDuration={story.video.duration}
          />
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap grid gap-12 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <p className="m-eyebrow">What you just saw</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712]">
              One connected musical workflow.
            </h2>
          </div>
          <div className="grid gap-3">
            {story.steps.map((step, index) => (
              <div key={step} className="grid grid-cols-[44px_1fr] gap-4 rounded-2xl border border-black/10 p-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#151712] text-sm font-semibold text-[#c9f46a]">
                  {index + 1}
                </span>
                <p className="self-center text-base font-medium leading-6 text-[#151712]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section bg-[#ecebe4]">
        <div className="m-wrap grid gap-12 lg:grid-cols-2">
          <div>
            <p className="m-eyebrow">Inside this feature</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712]">
              The deeper tools stay available when you need them.
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {story.capabilities.map((capability) => (
                <div key={capability} className="flex gap-3 rounded-2xl bg-white p-4 text-sm font-medium text-black/70">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#667d25]" size={17} />
                  {capability}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-[#151712] p-7 text-white md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#c9f46a]">Connected workflow</p>
            <div className="mt-6 grid gap-3">
              {story.connectedFlow.map((item, index) => (
                <div key={item}>
                  <div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4 text-lg font-medium">
                    {item}
                  </div>
                  {index < story.connectedFlow.length - 1 ? (
                    <div className="flex h-8 items-center pl-5 text-white/35">
                      <ArrowRight size={17} className="rotate-90" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap rounded-[2rem] bg-[#0d0f0c] px-7 py-10 text-white md:px-12 md:py-14">
          <p className="m-eyebrow">Keep exploring</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-3xl font-[family-name:var(--font-instrument-serif)] text-4xl md:text-5xl">
              See how the other SmartBridge workflows use the same song context.
            </h2>
            <Link href="/explore" className="m-button m-button-primary">
              Explore all features <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
