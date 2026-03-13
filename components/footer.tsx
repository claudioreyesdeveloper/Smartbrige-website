import { Music } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-16">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-amber-500 text-white p-2 rounded-lg">
                <Music className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl tracking-tight">SmartBridge</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              From MIDI phrase to full arrangement. A connected workflow for Yamaha keyboard musicians.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Demo Videos</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Request Access</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">About</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">About the Creator</a></li>
              <li><a href="mailto:claudio@smartbridge.dev" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Roadmap</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">2025 SmartBridge. An independent project by Claudio.</p>
          <p className="text-slate-600 text-xs">
            Not affiliated with Yamaha Corporation.
          </p>
        </div>
      </div>
    </footer>
  )
}
