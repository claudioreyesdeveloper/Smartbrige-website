import { Music } from "lucide-react"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Music className="w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={1.5} />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">SmartBridge</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Your Yamaha, Unlocked</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-6 lg:gap-8">
            <a href="#experience" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Experience
            </a>
            <a href="#editions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Editions
            </a>
            <a href="#support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Support
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
