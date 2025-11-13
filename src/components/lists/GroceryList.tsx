"use client"

import * as React from "react"
import { Plus, Trash2, Check } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils"

interface ListItem {
  id: string
  name: string
  quantity: number
  unit?: string
  estimatedCost?: number
  actualCost?: number
  status: string
  assignedTo?: {
    id: string
    fullName: string
  }
  purchasedBy?: {
    id: string
    fullName: string
  }
}

interface GroceryListProps {
  tripId: string
  members: Array<{ id: string; fullName: string }>
}

export function GroceryList({ tripId, members }: GroceryListProps) {
  const [items, setItems] = React.useState<ListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [newItem, setNewItem] = React.useState({
    name: "",
    quantity: 1,
    unit: "",
    estimatedCost: "",
    assignedToId: "",
  })
  const { toast } = useToast()

  React.useEffect(() => {
    fetchItems()
  }, [tripId])

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/lists?category=grocery`)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error("Error fetching grocery items:", error)
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
          category: "grocery",
          estimatedCost: newItem.estimatedCost ? parseFloat(newItem.estimatedCost) : null,
        }),
      })

      if (response.ok) {
        const item = await response.json()
        setItems([item, ...items])
        setNewItem({ name: "", quantity: 1, unit: "", estimatedCost: "", assignedToId: "" })
        toast({
          title: "Item added",
          description: "Grocery item added successfully",
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

  const handleToggleComplete = async (item: ListItem) => {
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
          description: "Grocery item deleted successfully",
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

  const pendingItems = items.filter((i) => i.status !== "completed")
  const completedItems = items.filter((i) => i.status === "completed")
  const totalCost = items.reduce((sum, i) => sum + (Number(i.actualCost || i.estimatedCost) || 0), 0)

  if (loading) {
    return <LoadingSpinner size="lg" className="py-8" />
  }

  return (
    <div className="space-y-6">
      {/* Add Item Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Grocery Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g., Milk"
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
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  placeholder="e.g., gallons"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Est. Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={newItem.estimatedCost}
                  onChange={(e) => setNewItem({ ...newItem, estimatedCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assigned">Assigned To</Label>
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
              <div className="flex items-end">
                <Button type="submit" disabled={adding} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{completedItems.length}</div>
            <p className="text-xs text-muted-foreground">Purchased</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">Total Cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>To Purchase ({pendingItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => handleToggleComplete(item)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit || "unit(s)"}
                      {item.assignedTo && ` • ${item.assignedTo.fullName}`}
                      {item.estimatedCost && ` • ${formatCurrency(Number(item.estimatedCost))}`}
                    </div>
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
      )}

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Purchased ({completedItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => handleToggleComplete(item)}
                  />
                  <div className="flex-1 min-w-0 opacity-60">
                    <div className="font-medium line-through">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit || "unit(s)"}
                      {item.purchasedBy && ` • Purchased by ${item.purchasedBy.fullName}`}
                    </div>
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
      )}

      {items.length === 0 && (
        <EmptyState
          title="No grocery items yet"
          description="Add items to your grocery list to get started"
        />
      )}
    </div>
  )
}
