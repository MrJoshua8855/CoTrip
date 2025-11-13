import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"

const prisma = new PrismaClient()

// POST /api/comments - Create comment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { content, proposalId, expenseId, tripId, parentCommentId } = body

    if (!content || (!proposalId && !expenseId && !tripId)) {
      return NextResponse.json(
        { error: "Content and at least one reference (proposalId, expenseId, or tripId) are required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user has access to the resource
    let hasAccess = false
    let resourceTripId = tripId

    if (proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          trip: {
            include: {
              members: true,
            },
          },
        },
      })

      if (proposal) {
        resourceTripId = proposal.tripId
        hasAccess = proposal.trip.members.some((m) => m.userId === user.id)
      }
    } else if (expenseId) {
      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: {
          trip: {
            include: {
              members: true,
            },
          },
        },
      })

      if (expense) {
        resourceTripId = expense.tripId
        hasAccess = expense.trip.members.some((m) => m.userId === user.id)
      }
    } else if (tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          members: true,
        },
      })

      if (trip) {
        hasAccess = trip.members.some((m) => m.userId === user.id)
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse @mentions from content
    const mentionRegex = /@(\w+)/g
    const mentions = content.match(mentionRegex) || []

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        userId: user.id,
        content,
        proposalId,
        expenseId,
        tripId: resourceTripId,
        parentCommentId,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Create notifications for mentions
    if (mentions.length > 0 && resourceTripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: resourceTripId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      })

      if (trip) {
        const mentionedUsers = trip.members
          .filter((m) => {
            const username = m.user.username || m.user.email?.split("@")[0]
            return mentions.some((mention) => mention === `@${username}`)
          })
          .filter((m) => m.userId !== user.id)

        for (const member of mentionedUsers) {
          await prisma.notification.create({
            data: {
              userId: member.userId,
              tripId: resourceTripId,
              type: "COMMENT_MENTION",
              title: "You were mentioned in a comment",
              message: `${user.fullName || user.email} mentioned you: ${content.slice(0, 100)}`,
              data: {
                commentId: comment.id,
                proposalId,
                expenseId,
              },
            },
          })
        }
      }
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/comments - Get comments for a resource
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get("proposalId")
    const expenseId = searchParams.get("expenseId")
    const tripId = searchParams.get("tripId")

    if (!proposalId && !expenseId && !tripId) {
      return NextResponse.json(
        { error: "proposalId, expenseId, or tripId is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const where: any = {}
    if (proposalId) where.proposalId = proposalId
    if (expenseId) where.expenseId = expenseId
    if (tripId) where.tripId = tripId

    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
