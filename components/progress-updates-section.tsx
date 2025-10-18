"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Calendar, TrendingUp } from "lucide-react"

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

export function ProgressUpdatesSection() {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([])
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({})
  const [authorName, setAuthorName] = useState<{ [key: string]: string }>({})
  const [showCommentForm, setShowCommentForm] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    // Load updates from localStorage
    const stored = localStorage.getItem("smartbridge_progress_updates")
    if (stored) {
      setUpdates(JSON.parse(stored))
    }
  }, [])

  const handleAddComment = (updateId: string) => {
    if (!commentText[updateId]?.trim() || !authorName[updateId]?.trim()) return

    const updatedUpdates = updates.map((update) => {
      if (update.id === updateId) {
        return {
          ...update,
          comments: [
            ...update.comments,
            {
              id: Date.now().toString(),
              author: authorName[updateId],
              comment: commentText[updateId],
              date: new Date().toISOString(),
            },
          ],
        }
      }
      return update
    })

    setUpdates(updatedUpdates)
    localStorage.setItem("smartbridge_progress_updates", JSON.stringify(updatedUpdates))

    // Clear form
    setCommentText({ ...commentText, [updateId]: "" })
    setAuthorName({ ...authorName, [updateId]: "" })
    setShowCommentForm({ ...showCommentForm, [updateId]: false })
  }

  if (updates.length === 0) {
    return (
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-balance">Development Updates</h2>
          <p className="text-lg text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto">
            Claudio will share progress updates here as SmartBridge evolves. Check back soon!
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-background/50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-balance">Development Updates</h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Follow along as SmartBridge grows. Your feedback on each milestone helps shape what comes next.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-8">
          {updates.map((update, index) => (
            <Card
              key={update.id}
              className="p-6 md:p-8 bg-card/50 backdrop-blur-sm border-border/50 hover:border-amber-500/30 transition-all duration-300"
            >
              {/* Update Header */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium">
                      {update.version}
                    </span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(update.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-3">{update.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{update.description}</p>
                </div>
              </div>

              {/* Screenshots Display */}
              {update.screenshots && update.screenshots.length > 0 && (
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {update.screenshots.map((screenshot, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-video rounded-lg overflow-hidden border border-border/50 hover:border-amber-500/30 transition-all cursor-pointer group"
                      >
                        <img
                          src={screenshot || "/placeholder.svg"}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Progress
                  </span>
                  <span className="text-sm font-bold text-amber-500">{update.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 rounded-full"
                    style={{ width: `${update.progress}%` }}
                  />
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t border-border/50 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Community Feedback ({update.comments.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setShowCommentForm({
                        ...showCommentForm,
                        [update.id]: !showCommentForm[update.id],
                      })
                    }
                    className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  >
                    Leave Feedback
                  </Button>
                </div>

                {/* Existing Comments */}
                {update.comments.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {update.comments.map((comment) => (
                      <div key={comment.id} className="p-4 rounded-lg bg-muted/30 border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Form */}
                {showCommentForm[update.id] && (
                  <div className="space-y-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <input
                      type="text"
                      placeholder="Your name"
                      value={authorName[update.id] || ""}
                      onChange={(e) => setAuthorName({ ...authorName, [update.id]: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                    <Textarea
                      placeholder="Share your thoughts on this update..."
                      value={commentText[update.id] || ""}
                      onChange={(e) => setCommentText({ ...commentText, [update.id]: e.target.value })}
                      className="min-h-[100px] resize-none bg-background border-border focus:border-amber-500"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAddComment(update.id)}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        Submit Feedback
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowCommentForm({ ...showCommentForm, [update.id]: false })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
