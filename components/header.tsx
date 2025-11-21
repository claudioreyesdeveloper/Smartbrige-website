import { Music } from "lucide-react"
import Link from "next/link"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#faf9f6]/90 backdrop-blur-sm border-b border-slate-100 transition-all duration-300">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-slate-900 text-white p-1.5 rounded-lg group-hover:bg-amber-600 transition-colors">
            <Music className="w-5 h-5" strokeWidth={2} />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">SmartBridge</span>
        </Link>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:block">
          Personal Creative Tool
        </div>
      </div>
    </header>
  )
}
