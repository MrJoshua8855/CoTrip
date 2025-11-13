'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Receipt,
  Calendar,
  User,
  DollarSign,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category?: string;
  description: string;
  receiptUrl?: string | null;
  expenseDate: string;
  splitType: string;
  status: string;
  paidBy?: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  } | null;
  splits: {
    id: string;
    userId: string;
    amount: number;
    percentage: number | null;
    user: {
      id: string;
      fullName: string | null;
      email: string;
    };
  }[];
}

interface ExpenseListProps {
  expenses: Expense[];
  tripId: string;
  currentUserId?: string;
  onEdit?: (expense: Expense) => void;
}

export function ExpenseList({
  expenses,
  tripId,
  currentUserId,
  onEdit,
}: ExpenseListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const queryClient = useQueryClient();

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete expense');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['settlements', tripId] });
      toast.success('Expense deleted!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = async (expenseId: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await deleteExpenseMutation.mutateAsync(expenseId);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter and sort expenses
  const filteredExpenses = expenses
    .filter((expense) => !categoryFilter || expense.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
      } else {
        return b.amount - a.amount;
      }
    });

  // Get unique categories for filter
  const categories = Array.from(new Set(expenses.map((e) => e.category).filter(Boolean)));

  // Calculate totals
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'accommodation':
        return 'bg-purple-100 text-purple-800';
      case 'food':
        return 'bg-orange-100 text-orange-800';
      case 'transportation':
        return 'bg-blue-100 text-blue-800';
      case 'activities':
        return 'bg-green-100 text-green-800';
      case 'shopping':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return 'Other';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No expenses yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by adding your first expense.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <button
            onClick={() => setSortBy('date')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              sortBy === 'date'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Date
          </button>
          <button
            onClick={() => setSortBy('amount')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              sortBy === 'amount'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Amount
          </button>
        </div>

        <div className="ml-auto text-sm font-medium">
          Total: <span className="text-blue-600">${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Expense List */}
      <div className="space-y-3">
        {filteredExpenses.map((expense) => {
          const isExpanded = expandedId === expense.id;
          const canEdit = currentUserId === expense.paidBy?.id;

          return (
            <div
              key={expense.id}
              className="border border-gray-200 rounded-lg hover:shadow-md transition"
            >
              {/* Main Row */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleExpand(expense.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {expense.description}
                      </h3>
                      {expense.category && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                            expense.category
                          )}`}
                        >
                          {getCategoryLabel(expense.category)}
                        </span>
                      )}
                      {expense.receiptUrl && (
                        <Receipt className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>
                          {expense.paidBy?.fullName || expense.paidBy?.email || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(expense.expenseDate), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          {expense.splitType === 'equal' && 'Split equally'}
                          {expense.splitType === 'percentage' && 'Split by %'}
                          {expense.splitType === 'amount' && 'Custom split'}
                          {expense.splitType === 'opt_in' && 'Opt-in split'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900">
                        ${expense.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {expense.splits.length} {expense.splits.length === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {/* Splits */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Split Details</h4>
                    <div className="space-y-1.5">
                      {expense.splits.map((split) => (
                        <div
                          key={split.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-700">
                            {split.user.fullName || split.user.email}
                          </span>
                          <span className="font-medium">
                            ${split.amount.toFixed(2)}
                            {split.percentage && (
                              <span className="text-gray-500 ml-1">
                                ({split.percentage.toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Receipt */}
                  {expense.receiptUrl && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Receipt</h4>
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={expense.receiptUrl}
                          alt="Receipt"
                          className="max-w-xs h-48 object-cover rounded border hover:opacity-80 transition"
                        />
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(expense);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(expense.id);
                        }}
                        disabled={deleteExpenseMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-blue-900">
            Showing {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
          </span>
          <span className="text-lg font-bold text-blue-900">
            Total: ${totalAmount.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
