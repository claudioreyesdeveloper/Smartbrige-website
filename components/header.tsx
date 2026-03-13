"use client"

import { useState, useEffect } from "react"
import { Music, Menu, X } from "lucide-react"
import Link from "next/link"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200" 
        : "bg-transparent"
    }`}>
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="bg-amber-500 text-white p-2 rounded-lg group-hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25">
            <Music className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900 text-xl tracking-tight">SmartBridge</span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Features
          </a>
          <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Demo
          </a>
          <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            About
          </a>
          <a 
            href="#" 
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-amber-500/25"
          >
            Request Access
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-slate-600 hover:text-slate-900"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-stone-200 shadow-lg">
          <nav className="container mx-auto px-6 py-4 flex flex-col gap-4">
            <a 
              href="#features" 
              className="text-base font-medium text-slate-600 hover:text-slate-900 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a href="#" className="text-base font-medium text-slate-600 hover:text-slate-900 py-2">
              Demo
            </a>
            <a href="#" className="text-base font-medium text-slate-600 hover:text-slate-900 py-2">
              About
            </a>
            <a 
              href="#" 
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white text-base font-medium rounded-lg text-center"
            >
              Request Access
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
