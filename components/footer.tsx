import Link from "next/link"
import { Music, Github, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Music className="h-6 w-6 text-primary" strokeWidth={1.5} />
              <span className="text-xl font-bold text-foreground">SmartBridge</span>
            </Link>
            <p className="text-sm text-muted-foreground">Your Yamaha, Unlocked.</p>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-foreground">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#experience" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#editions" className="text-muted-foreground hover:text-foreground transition-colors">
                  Editions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-foreground">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#support" className="text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="#support" className="text-muted-foreground hover:text-foreground transition-colors">
                  Support
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:claudio.private@gmail.com"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-foreground">Connect</h3>
            <div className="flex gap-3">
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="h-5 w-5" strokeWidth={1.5} />
              </Link>
              <Link
                href="mailto:claudio.private@gmail.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-5 w-5" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground space-y-2">
          <p>© 2025 SmartBridge – An independent project by Claudio.</p>
          <p className="text-xs">Not affiliated with Yamaha Corporation.</p>
        </div>
      </div>
    </footer>
  )
}
