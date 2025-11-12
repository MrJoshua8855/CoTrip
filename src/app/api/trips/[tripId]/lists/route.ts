import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"

const prisma = new PrismaClient()

// GET /api/trips/:tripId/lists - Get all lists for trip
export async function GET(
  request: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tripId } = params
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    // Verify user has access to trip
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const tripMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: user.id,
        },
      },
    })

    if (!tripMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get list items
    const where: any = { tripId }
    if (category) {
      where.category = category
    }

    const listItems = await prisma.listItem.findMany({
      where,
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
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(listItems)
  } catch (error) {
    console.error("Error fetching list items:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/trips/:tripId/lists - Create list item
export async function POST(
  request: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tripId } = params
    const body = await request.json()

    // Verify user has access to trip
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const tripMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: user.id,
        },
      },
    })

    if (!tripMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate input
    const { name, category, quantity, unit, estimatedCost, assignedToId, notes } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      )
    }

    // Create list item
    const listItem = await prisma.listItem.create({
      data: {
        tripId,
        name,
        category,
        quantity: quantity || 1,
        unit,
        estimatedCost,
        assignedToId,
        notes,
        status: "pending",
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

    return NextResponse.json(listItem, { status: 201 })
  } catch (error) {
    console.error("Error creating list item:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
