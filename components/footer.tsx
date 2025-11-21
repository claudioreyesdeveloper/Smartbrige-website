import { Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-12">
      <div className="container mx-auto px-6 text-center">
        <div className="flex items-center justify-center gap-2 text-slate-400 mb-4">
          <Heart className="w-4 h-4 fill-current" />
        </div>
        <p className="text-slate-500 text-sm mb-2">© 2025 SmartBridge — An independent project by Claudio.</p>
        <p className="text-slate-400 text-xs">
          Not affiliated with Yamaha Corporation. Built with passion for the community.
        </p>
      </div>
    </footer>
  )
}
