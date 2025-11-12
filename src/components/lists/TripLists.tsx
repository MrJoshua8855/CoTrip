"use client"

import * as React from "react"
import { ShoppingCart, Backpack, CheckSquare, Wrench } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GroceryList } from "./GroceryList"
import { PackingList } from "./PackingList"

interface TripListsProps {
  tripId: string
  members: Array<{ id: string; fullName: string; email: string }>
}

export function TripLists({ tripId, members }: TripListsProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="grocery" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="grocery" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Grocery</span>
          </TabsTrigger>
          <TabsTrigger value="packing" className="gap-2">
            <Backpack className="h-4 w-4" />
            <span className="hidden sm:inline">Packing</span>
          </TabsTrigger>
          <TabsTrigger value="todo" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">To-Do</span>
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-2">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Equipment</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grocery" className="mt-6">
          <GroceryList tripId={tripId} members={members} />
        </TabsContent>

        <TabsContent value="packing" className="mt-6">
          <PackingList tripId={tripId} members={members} />
        </TabsContent>

        <TabsContent value="todo" className="mt-6">
          <GenericList tripId={tripId} members={members} category="todo" title="To-Do List" />
        </TabsContent>

        <TabsContent value="equipment" className="mt-6">
          <GenericList tripId={tripId} members={members} category="equipment" title="Equipment List" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Generic list component for todo and equipment lists
function GenericList({
  tripId,
  members,
  category,
  title,
}: {
  tripId: string
  members: Array<{ id: string; fullName: string }>
  category: string
  title: string
}) {
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [newItem, setNewItem] = React.useState({
    name: "",
    assignedToId: "",
    notes: "",
  })

  React.useEffect(() => {
    fetchItems()
  }, [tripId, category])

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/lists?category=${category}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error(`Error fetching ${category} items:`, error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.name.trim()) return

    setAdding(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          category,
          quantity: 1,
        }),
      })

      if (response.ok) {
        const item = await response.json()
        setItems([item, ...items])
        setNewItem({ name: "", assignedToId: "", notes: "" })
      }
    } catch (error) {
      console.error("Error adding item:", error)
    } finally {
      setAdding(false)
    }
  }

  const handleToggleComplete = async (item: any) => {
    try {
      const response = await fetch(`/api/lists/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "completed" ? "pending" : "completed",
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setItems(items.map((i) => (i.id === item.id ? updated : i)))
      }
    } catch (error) {
      console.error("Error updating item:", error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/lists/${itemId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setItems(items.filter((i) => i.id !== itemId))
      }
    } catch (error) {
      console.error("Error deleting item:", error)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddItem} className="flex gap-2">
        <input
          type="text"
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          placeholder={`Add ${category} item...`}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              item.status === "completed" ? "bg-muted/30" : "bg-card"
            }`}
          >
            <input
              type="checkbox"
              checked={item.status === "completed"}
              onChange={() => handleToggleComplete(item)}
              className="h-4 w-4"
            />
            <div className="flex-1">
              <div className={item.status === "completed" ? "line-through opacity-60" : ""}>
                {item.name}
              </div>
              {item.assignedTo && (
                <div className="text-sm text-muted-foreground">
                  {item.assignedTo.fullName}
                </div>
              )}
            </div>
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No {category} items yet. Add one to get started!
        </div>
      )}
    </div>
  )
}

// Import LoadingSpinner
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
