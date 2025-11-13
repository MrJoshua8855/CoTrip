"use client"

import * as React from "react"
import {
  Bell,
  BellOff,
  Trash2,
  Users,
  Vote,
  DollarSign,
  Calendar,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { formatRelativeTime } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface Notification {
  id: string
  type: string
  title: string
  message?: string
  data: any
  isRead: boolean
  createdAt: string
  trip?: {
    id: string
    name: string
  }
}

export function NotificationList() {
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<"all" | "unread" | "read">("all")
  const router = useRouter()

  React.useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PUT",
      })

      if (response.ok) {
        setNotifications(
          notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        )
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setNotifications(notifications.filter((n) => n.id !== notificationId))
      }
    } catch (error) {
      console.error("Error deleting notification:", error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }

    // Navigate based on notification type
    if (notification.trip) {
      router.push(`/trips/${notification.trip.id}`)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TRIP_INVITE":
        return <Users className="h-5 w-5" />
      case "MEMBER_JOINED":
        return <Users className="h-5 w-5" />
      case "PROPOSAL_CREATED":
        return <Calendar className="h-5 w-5" />
      case "VOTE_DEADLINE":
        return <Vote className="h-5 w-5" />
      case "EXPENSE_ADDED":
        return <DollarSign className="h-5 w-5" />
      case "SETTLEMENT_REQUESTED":
        return <DollarSign className="h-5 w-5" />
      case "COMMENT_MENTION":
        return <MessageSquare className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead
    if (filter === "read") return n.isRead
    return true
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={filter === "unread" ? BellOff : Bell}
              title={`No ${filter === "all" ? "" : filter} notifications`}
              description={
                filter === "unread"
                  ? "You're all caught up! Check back later for updates."
                  : "Notifications will appear here when you receive them."
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    !notification.isRead ? "border-l-4 border-l-primary" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-sm md:text-base">
                              {notification.title}
                            </h3>
                            {notification.message && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span>{formatRelativeTime(notification.createdAt)}</span>
                              {notification.trip && (
                                <>
                                  <span>•</span>
                                  <span>{notification.trip.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
