"use client"

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { X } from "lucide-react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

export function nextDialogFocusIndex(
  currentIndex: number,
  count: number,
  backwards: boolean,
): number {
  if (count <= 0) return -1
  if (currentIndex < 0) return backwards ? count - 1 : 0
  return backwards
    ? (currentIndex - 1 + count) % count
    : (currentIndex + 1) % count
}

export function PlayerPanelDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
      .filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1)
    if (focusable.length === 0) {
      event.preventDefault()
      panelRef.current?.focus()
      return
    }
    const current = focusable.indexOf(document.activeElement as HTMLElement)
    const next = nextDialogFocusIndex(current, focusable.length, event.shiftKey)
    if (
      current === -1 ||
      (!event.shiftKey && current === focusable.length - 1) ||
      (event.shiftKey && current === 0)
    ) {
      event.preventDefault()
      focusable[next]?.focus()
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/65 backdrop-blur-sm lg:items-center lg:justify-center lg:p-6">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close panel"
        tabIndex={-1}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#101010] p-4 shadow-2xl lg:max-w-6xl lg:rounded-3xl lg:border"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-sm font-medium">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
