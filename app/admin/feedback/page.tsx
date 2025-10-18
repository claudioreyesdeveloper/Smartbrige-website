"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Download, Trash2, Star, Lock } from "lucide-react"
import Link from "next/link"

interface Feedback {
  feature: string
  easeOfUse: {
    rating: number
    comment: string
  }
  additionalComments: string
  timestamp: string
  userAgent: string
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [filterFeature, setFilterFeature] = useState<string>("all")

  useEffect(() => {
    const auth = sessionStorage.getItem("smartbridge-admin-auth")
    if (auth === "true") {
      setIsAuthenticated(true)
      loadFeedback()
    }
  }, [])

  const loadFeedback = () => {
    const savedFeedback = localStorage.getItem("smartbridge-feedback")
    if (savedFeedback) {
      setFeedback(JSON.parse(savedFeedback))
    }
  }

  const handleLogin = () => {
    if (password === "smartbridge2024") {
      setIsAuthenticated(true)
      sessionStorage.setItem("smartbridge-admin-auth", "true")
      loadFeedback()
    } else {
      alert("Incorrect password")
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(feedback, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `smartbridge-feedback-${new Date().toISOString().split("T")[0]}.json`
    link.click()
  }

  const handleClearAll = () => {
    if (confirm("Are you sure you want to delete all feedback? This cannot be undone.")) {
      localStorage.removeItem("smartbridge-feedback")
      setFeedback([])
    }
  }

  const features = [...new Set(feedback.map((f) => f.feature))]
  const filteredFeedback = filterFeature === "all" ? feedback : feedback.filter((f) => f.feature === filterFeature)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1f2e] via-[#1e2433] to-[#222938] flex items-center justify-center p-4">
        <Card className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-white/10 p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 font-heading">Admin Access</h1>
            <p className="text-gray-400">Enter password to view feedback</p>
          </div>
          <div className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin password"
              className="bg-slate-900/50 border-slate-700 text-white"
            />
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              Login
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1f2e] via-[#1e2433] to-[#222938]">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/feature-voting"
            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Voting</span>
          </Link>
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 bg-transparent"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button
              onClick={handleClearAll}
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 font-heading">Feature Feedback Dashboard</h1>
          <p className="text-gray-400 mb-6">
            Total feedback submissions: <strong className="text-white">{feedback.length}</strong>
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setFilterFeature("all")}
              variant={filterFeature === "all" ? "default" : "outline"}
              size="sm"
              className={filterFeature === "all" ? "bg-amber-500 hover:bg-amber-600" : "border-white/20 text-white"}
            >
              All Features ({feedback.length})
            </Button>
            {features.map((feature) => (
              <Button
                key={feature}
                onClick={() => setFilterFeature(feature)}
                variant={filterFeature === feature ? "default" : "outline"}
                size="sm"
                className={filterFeature === feature ? "bg-amber-500 hover:bg-amber-600" : "border-white/20 text-white"}
              >
                {feature} ({feedback.filter((f) => f.feature === feature).length})
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {filteredFeedback.length === 0 ? (
            <Card className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-white/10 p-12 text-center">
              <p className="text-gray-400 text-lg">No feedback submissions yet.</p>
            </Card>
          ) : (
            filteredFeedback.map((item, index) => (
              <Card key={index} className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-white/10 p-6">
                <div className="mb-4 pb-4 border-b border-white/10">
                  <h3 className="text-xl font-bold text-amber-400 mb-2 font-heading">{item.feature}</h3>
                  <p className="text-sm text-gray-400">Submitted: {new Date(item.timestamp).toLocaleString()}</p>
                </div>

                <div className="space-y-4">
                  {/* Ease of Use Section */}
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">Ease of Use</h4>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < item.easeOfUse.rating ? "fill-amber-400 text-amber-400" : "text-gray-600"
                            }`}
                          />
                        ))}
                        <span className="ml-2 text-sm font-bold text-amber-400">{item.easeOfUse.rating}/5</span>
                      </div>
                    </div>
                    {item.easeOfUse.comment && (
                      <p className="text-sm text-gray-300 leading-relaxed">{item.easeOfUse.comment}</p>
                    )}
                  </div>

                  {/* Additional Comments Section */}
                  {item.additionalComments && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <h4 className="font-semibold text-white mb-3">Additional Comments</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{item.additionalComments}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
