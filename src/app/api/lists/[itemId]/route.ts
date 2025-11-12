import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"

const prisma = new PrismaClient()

// PUT /api/lists/:itemId - Update list item
export async function PUT(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { itemId } = params
    const body = await request.json()

    // Get the list item
    const listItem = await prisma.listItem.findUnique({
      where: { id: itemId },
      include: {
        trip: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!listItem) {
      return NextResponse.json({ error: "List item not found" }, { status: 404 })
    }

    // Verify user has access to trip
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isMember = listItem.trip.members.some(
      (member) => member.userId === user.id
    )

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Update list item
    const updatedItem = await prisma.listItem.update({
      where: { id: itemId },
      data: {
        ...body,
        updatedAt: new Date(),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        purchasedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error("Error updating list item:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/lists/:itemId - Delete list item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { itemId } = params

    // Get the list item
    const listItem = await prisma.listItem.findUnique({
      where: { id: itemId },
      include: {
        trip: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!listItem) {
      return NextResponse.json({ error: "List item not found" }, { status: 404 })
    }

    // Verify user has access to trip
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isMember = listItem.trip.members.some(
      (member) => member.userId === user.id
    )

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete list item
    await prisma.listItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ message: "List item deleted successfully" })
  } catch (error) {
    console.error("Error deleting list item:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
