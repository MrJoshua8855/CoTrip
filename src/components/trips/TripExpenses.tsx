'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, DollarSign, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ExpenseList } from '@/components/expenses/ExpenseList';

interface TripExpensesProps {
  tripId: string;
  currentUserId: string;
  onViewSettlements?: () => void;
}

export function TripExpenses({
  tripId,
  currentUserId,
  onViewSettlements,
}: TripExpensesProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  // Fetch expenses
  const {
    data: expenses = [],
    isLoading: expensesLoading,
    error: expensesError,
  } = useQuery({
    queryKey: ['expenses', tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/expenses`);
      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }
      return response.json();
    },
  });

  // Fetch trip members
  const {
    data: members = [],
    isLoading: membersLoading,
  } = useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      return response.json();
    },
  });

  // Calculate summary statistics
  const totalExpenses = expenses.reduce(
    (sum: number, expense: any) => sum + expense.amount,
    0
  );

  const userExpenses = expenses.reduce((acc: Record<string, number>, expense: any) => {
    if (expense.paidBy?.id) {
      acc[expense.paidBy.id] = (acc[expense.paidBy.id] || 0) + expense.amount;
    }
    return acc;
  }, {});

  const userOwed = expenses.reduce((acc: Record<string, number>, expense: any) => {
    expense.splits?.forEach((split: any) => {
      acc[split.userId] = (acc[split.userId] || 0) + split.amount;
    });
    return acc;
  }, {});

  const currentUserPaid = userExpenses[currentUserId] || 0;
  const currentUserOwes = userOwed[currentUserId] || 0;
  const currentUserBalance = currentUserPaid - currentUserOwes;

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingExpense(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingExpense(null);
  };

  if (expensesLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (expensesError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load expenses. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Expenses</p>
          <p className="text-3xl font-bold">${totalExpenses.toFixed(2)}</p>
          <p className="text-xs opacity-75 mt-1">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Your Spending */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">You Paid</p>
          <p className="text-3xl font-bold">${currentUserPaid.toFixed(2)}</p>
          <p className="text-xs opacity-75 mt-1">
            You owe: ${currentUserOwes.toFixed(2)}
          </p>
        </div>

        {/* Your Balance */}
        <div
          className={`rounded-lg p-6 text-white ${
            currentUserBalance > 0
              ? 'bg-gradient-to-br from-green-500 to-green-600'
              : currentUserBalance < 0
              ? 'bg-gradient-to-br from-red-500 to-red-600'
              : 'bg-gradient-to-br from-gray-500 to-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">Your Balance</p>
          <p className="text-3xl font-bold">
            {currentUserBalance > 0 ? '+' : ''}${Math.abs(currentUserBalance).toFixed(2)}
          </p>
          <p className="text-xs opacity-75 mt-1">
            {currentUserBalance > 0
              ? 'You are owed'
              : currentUserBalance < 0
              ? 'You owe'
              : 'All settled'}
          </p>
        </div>
      </div>

      {/* View Settlements Button */}
      {expenses.length > 0 && onViewSettlements && (
        <button
          onClick={onViewSettlements}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-blue-800 transition flex items-center justify-center gap-2 font-medium"
        >
          <span>View Settlements & Payments</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      )}

      {/* Add Expense Button / Form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingExpense ? 'Edit Expense' : 'Add New Expense'}
          </h3>
          <ExpenseForm
            tripId={tripId}
            members={members}
            expense={editingExpense}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* Expense List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Expense History</h3>
        <ExpenseList
          expenses={expenses}
          tripId={tripId}
          currentUserId={currentUserId}
          onEdit={handleEdit}
        />
      </div>

      {/* Per-User Summary */}
      {members.length > 0 && expenses.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Per-Person Summary</h3>
          <div className="space-y-2">
            {members.map((member: any) => {
              const paid = userExpenses[member.userId] || 0;
              const owed = userOwed[member.userId] || 0;
              const balance = paid - owed;

              return (
                <div
                  key={member.userId}
                  className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.fullName || member.user.email}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.user.fullName || member.user.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        Paid ${paid.toFixed(2)} • Owes ${owed.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-right font-semibold ${
                      balance > 0
                        ? 'text-green-600'
                        : balance < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {balance > 0 ? '+' : ''}${balance.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
