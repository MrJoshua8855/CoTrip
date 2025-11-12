"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

interface ListItem {
  id: string
  name: string
  quantity: number
  status: string
  assignedTo?: {
    id: string
    fullName: string
  }
  notes?: string
}

interface PackingListProps {
  tripId: string
  members: Array<{ id: string; fullName: string }>
}

export function PackingList({ tripId, members }: PackingListProps) {
  const [items, setItems] = React.useState<ListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [newItem, setNewItem] = React.useState({
    name: "",
    quantity: 1,
    assignedToId: "",
    notes: "",
  })
  const { toast } = useToast()

  React.useEffect(() => {
    fetchItems()
  }, [tripId])

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/lists?category=packing`)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error("Error fetching packing items:", error)
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
          category: "packing",
        }),
      })

      if (response.ok) {
        const item = await response.json()
        setItems([item, ...items])
        setNewItem({ name: "", quantity: 1, assignedToId: "", notes: "" })
        toast({
          title: "Item added",
          description: "Packing item added successfully",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  const handleTogglePacked = async (item: ListItem) => {
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
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      })
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/lists/${itemId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setItems(items.filter((i) => i.id !== itemId))
        toast({
          title: "Item deleted",
          description: "Packing item deleted successfully",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      })
    }
  }

  const packedItems = items.filter((i) => i.status === "completed")
  const unpackedItems = items.filter((i) => i.status !== "completed")
  const completionPercentage = items.length > 0
    ? Math.round((packedItems.length / items.length) * 100)
    : 0

  // Group by member
  const itemsByMember = items.reduce((acc, item) => {
    const key = item.assignedTo?.id || "unassigned"
    if (!acc[key]) {
      acc[key] = {
        name: item.assignedTo?.fullName || "Unassigned",
        items: [],
      }
    }
    acc[key].items.push(item)
    return acc
  }, {} as Record<string, { name: string; items: ListItem[] }>)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Add Item Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Packing Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g., Sleeping bag"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned">Who&apos;s Bringing It?</Label>
                <Select
                  value={newItem.assignedToId}
                  onValueChange={(value) => setNewItem({ ...newItem, assignedToId: value })}
                >
                  <SelectTrigger id="assigned">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={adding}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Packing Progress</span>
              <span className="font-medium">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{packedItems.length} packed</span>
              <span>{unpackedItems.length} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Grouped by Member */}
      {Object.entries(itemsByMember).map(([key, { name, items: memberItems }]) => (
        <Card key={key}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{name}</CardTitle>
              <Badge variant="secondary">
                {memberItems.filter((i) => i.status === "completed").length} / {memberItems.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {memberItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    item.status === "completed" ? "bg-muted/30" : "bg-card hover:bg-accent/50"
                  }`}
                >
                  <Checkbox
                    checked={item.status === "completed"}
                    onCheckedChange={() => handleTogglePacked(item)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${item.status === "completed" ? "line-through opacity-60" : ""}`}>
                      {item.name}
                    </div>
                    {(item.quantity > 1 || item.notes) && (
                      <div className="text-sm text-muted-foreground">
                        {item.quantity > 1 && `${item.quantity} units`}
                        {item.quantity > 1 && item.notes && " • "}
                        {item.notes}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {items.length === 0 && (
        <EmptyState
          title="No packing items yet"
          description="Add items to your packing list to keep track of what everyone needs to bring"
        />
      )}
    </div>
  )
}
