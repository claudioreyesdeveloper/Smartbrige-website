"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Trash2, Edit } from "lucide-react"
import Link from "next/link"

interface ProgressUpdate {
  id: string
  version: string
  title: string
  description: string
  progress: number
  date: string
  screenshots?: string[]
  comments: Array<{
    id: string
    author: string
    comment: string
    date: string
  }>
}

export default function AdminProgressPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [updates, setUpdates] = useState<ProgressUpdate[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    version: "",
    title: "",
    description: "",
    progress: 0,
    screenshots: [] as string[],
  })

  useEffect(() => {
    if (isAuthenticated) {
      loadUpdates()
    }
  }, [isAuthenticated])

  const loadUpdates = () => {
    const stored = localStorage.getItem("smartbridge_progress_updates")
    if (stored) {
      setUpdates(JSON.parse(stored))
    }
  }

  const handleLogin = () => {
    if (password === "claudio") {
      setIsAuthenticated(true)
    } else {
      alert("Incorrect password")
    }
  }

  const handleSubmit = () => {
    if (!formData.version || !formData.title || !formData.description) {
      alert("Please fill in all fields")
      return
    }

    let updatedUpdates: ProgressUpdate[]

    if (editingId) {
      // Update existing
      updatedUpdates = updates.map((update) => (update.id === editingId ? { ...update, ...formData } : update))
    } else {
      // Create new
      const newUpdate: ProgressUpdate = {
        id: Date.now().toString(),
        ...formData,
        date: new Date().toISOString(),
        comments: [],
      }
      updatedUpdates = [newUpdate, ...updates]
    }

    setUpdates(updatedUpdates)
    localStorage.setItem("smartbridge_progress_updates", JSON.stringify(updatedUpdates))

    // Reset form
    setFormData({ version: "", title: "", description: "", progress: 0, screenshots: [] })
    setIsEditing(false)
    setEditingId(null)
  }

  const handleEdit = (update: ProgressUpdate) => {
    setFormData({
      version: update.version,
      title: update.title,
      description: update.description,
      progress: update.progress,
      screenshots: update.screenshots || [],
    })
    setEditingId(update.id)
    setIsEditing(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this update?")) {
      const updatedUpdates = updates.filter((u) => u.id !== id)
      setUpdates(updatedUpdates)
      localStorage.setItem("smartbridge_progress_updates", JSON.stringify(updatedUpdates))
    }
  }

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const readers: Promise<string>[] = []

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string)
        }
        reader.readAsDataURL(file)
      })
      readers.push(promise)
    })

    Promise.all(readers).then((results) => {
      setFormData({
        ...formData,
        screenshots: [...formData.screenshots, ...results],
      })
    })
  }

  const removeScreenshot = (index: number) => {
    setFormData({
      ...formData,
      screenshots: formData.screenshots.filter((_, i) => i !== index),
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-background/50">
        <Card className="w-full max-w-md p-8 bg-card/50 backdrop-blur-sm">
          <h1 className="text-2xl font-heading font-bold mb-6 text-center">Admin: Progress Updates</h1>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button onClick={handleLogin} className="w-full">
              Login
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-background to-background/50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Site
            </Link>
            <h1 className="text-3xl font-heading font-bold">Manage Progress Updates</h1>
          </div>
          <Button
            onClick={() => {
              setIsEditing(!isEditing)
              setEditingId(null)
              setFormData({ version: "", title: "", description: "", progress: 0, screenshots: [] })
            }}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Update
          </Button>
        </div>

        {/* Create/Edit Form */}
        {isEditing && (
          <Card className="p-6 mb-8 bg-card/50 backdrop-blur-sm">
            <h2 className="text-xl font-heading font-bold mb-4">{editingId ? "Edit Update" : "Create New Update"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Version</label>
                <Input
                  placeholder="e.g., Version 1.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  placeholder="e.g., Chord Sequencer Development Begins"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="Share what you've been working on..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-[120px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Screenshots</label>
                <Input type="file" accept="image/*" multiple onChange={handleScreenshotUpload} className="mb-3" />
                {formData.screenshots.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {formData.screenshots.map((screenshot, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={screenshot || "/placeholder.svg"}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full aspect-video object-cover rounded-lg border border-border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeScreenshot(idx)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Progress: {formData.progress}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: Number.parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} className="bg-amber-500 hover:bg-amber-600">
                  {editingId ? "Update" : "Publish"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false)
                    setEditingId(null)
                    setFormData({ version: "", title: "", description: "", progress: 0, screenshots: [] })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Updates List */}
        <div className="space-y-4">
          {updates.map((update) => (
            <Card key={update.id} className="p-6 bg-card/50 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium">
                      {update.version}
                    </span>
                    <span className="text-sm text-muted-foreground">{new Date(update.date).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-xl font-heading font-bold mb-2">{update.title}</h3>
                  <p className="text-muted-foreground mb-3">{update.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-amber-500 font-medium">Progress: {update.progress}%</span>
                    <span className="text-muted-foreground">{update.comments.length} comments</span>
                  </div>
                  {update.screenshots && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                      {update.screenshots.map((screenshot, idx) => (
                        <img
                          key={idx}
                          src={screenshot || "/placeholder.svg"}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full aspect-video object-cover rounded-lg border border-border"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(update)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(update.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
