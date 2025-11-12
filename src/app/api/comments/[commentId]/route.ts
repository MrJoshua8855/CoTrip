import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"

const prisma = new PrismaClient()

// PUT /api/comments/:id - Edit comment
export async function PUT(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { commentId } = params
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get comment and check permission
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        trip: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      )
    }

    // Check if user is author or trip organizer
    const isAuthor = comment.userId === user.id
    const isOrganizer =
      comment.trip?.members.some(
        (m) => m.userId === user.id && m.role === "organizer"
      ) || false

    if (!isAuthor && !isOrganizer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Update comment
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        updatedAt: new Date(),
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating comment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/comments/:id - Delete comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { commentId } = params

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get comment and check permission
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        trip: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      )
    }

    // Check if user is author or trip organizer
    const isAuthor = comment.userId === user.id
    const isOrganizer =
      comment.trip?.members.some(
        (m) => m.userId === user.id && m.role === "organizer"
      ) || false

    if (!isAuthor && !isOrganizer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete comment
    await prisma.comment.delete({
      where: { id: commentId },
    })

    return NextResponse.json({ message: "Comment deleted successfully" })
  } catch (error) {
    console.error("Error deleting comment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
