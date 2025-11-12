"use client"

import * as React from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useToast } from "@/components/ui/use-toast"
import { CommentItem } from "./CommentItem"

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
  replies?: Comment[]
}

interface CommentSectionProps {
  proposalId?: string
  expenseId?: string
  tripId?: string
  currentUserId?: string
  canModerate?: boolean
}

export function CommentSection({
  proposalId,
  expenseId,
  tripId,
  currentUserId,
  canModerate = false,
}: CommentSectionProps) {
  const [comments, setComments] = React.useState<Comment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [newComment, setNewComment] = React.useState("")
  const { toast } = useToast()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    fetchComments()
  }, [proposalId, expenseId, tripId])

  const fetchComments = async () => {
    try {
      const params = new URLSearchParams()
      if (proposalId) params.append("proposalId", proposalId)
      if (expenseId) params.append("expenseId", expenseId)
      if (tripId) params.append("tripId", tripId)

      const response = await fetch(`/api/comments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error("Error fetching comments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          proposalId,
          expenseId,
          tripId,
        }),
      })

      if (response.ok) {
        const comment = await response.json()
        setComments([comment, ...comments])
        setNewComment("")
        toast({
          title: "Comment added",
          description: "Your comment has been posted",
        })
      } else {
        throw new Error("Failed to post comment")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (commentId: string, content: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const updated = await response.json()
        setComments(comments.map((c) => (c.id === commentId ? updated : c)))
        toast({
          title: "Comment updated",
          description: "Your comment has been updated",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update comment",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId))
        toast({
          title: "Comment deleted",
          description: "Your comment has been deleted",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      })
    }
  }

  const handleAtMention = (text: string) => {
    // Simple @mention autocomplete could be added here
    setNewComment(text)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => handleAtMention(e.target.value)}
            placeholder="Write a comment... (use @ to mention someone)"
            className="min-h-[100px] resize-none"
            disabled={submitting}
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Tip: Use @username to mention someone
            </p>
            <Button type="submit" disabled={submitting || !newComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Post Comment
            </Button>
          </div>
        </form>

        {/* Comments List */}
        {comments.length === 0 ? (
          <EmptyState
            title="No comments yet"
            description="Be the first to comment!"
          />
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
