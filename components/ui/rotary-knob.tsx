"use client"

import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from "react"
import { cn } from "@/lib/utils"

type Props = {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  label?: string
  displayValue?: string
  size?: "xs" | "sm" | "md"
  className?: string
}

const SIZE = {
  xs: { box: 56, indicator: 16, origin: 28 },
  sm: { box: 64, indicator: 18, origin: 32 },
  md: { box: 80, indicator: 22, origin: 40 },
} as const

/** Drag-vertical rotary control (tyros mixer pattern). */
export function RotaryKnob({
  value,
  min = 0,
  max = 127,
  onChange,
  label,
  displayValue,
  size = "xs",
  className,
}: Props) {
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const startValue = useRef(0)

  const pct = (value - min) / (max - min || 1)
  const rotation = -135 + pct * 270
  const dims = SIZE[size]

  useEffect(() => {
    if (!dragging) return

    const onMove = (clientY: number) => {
      const delta = startY.current - clientY
      const next = Math.max(min, Math.min(max, startValue.current + delta * 0.7))
      onChange(Math.round(next))
    }

    const onMouseMove = (e: globalThis.MouseEvent) => onMove(e.clientY)
    const onTouchMove = (e: globalThis.TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientY)
    }
    const onUp = () => setDragging(false)

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onUp)
    document.addEventListener("touchmove", onTouchMove, { passive: true })
    document.addEventListener("touchend", onUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onUp)
    }
  }, [dragging, min, max, onChange])

  const begin = (clientY: number) => {
    setDragging(true)
    startY.current = clientY
    startValue.current = value
  }

  return (
    <div className={cn("sm-knob", `is-${size}`, dragging && "is-dragging", className)}>
      <div
        className="sm-knob-dial"
        style={{ width: dims.box, height: dims.box }}
        onMouseDown={(e: MouseEvent) => {
          e.preventDefault()
          begin(e.clientY)
        }}
        onTouchStart={(e: TouchEvent) => {
          e.preventDefault()
          begin(e.touches[0].clientY)
        }}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label || "Knob"}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault()
            onChange(Math.min(max, value + 1))
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault()
            onChange(Math.max(min, value - 1))
          }
        }}
      >
        <span
          className="sm-knob-indicator"
          style={{
            height: dims.indicator,
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            transformOrigin: `center ${dims.origin}px`,
            transition: dragging ? "none" : "transform 0.1s ease-out",
          }}
        />
      </div>
      {displayValue != null && <div className="sm-knob-value">{displayValue}</div>}
      {label && <div className="sm-knob-label">{label}</div>}
    </div>
  )
}
