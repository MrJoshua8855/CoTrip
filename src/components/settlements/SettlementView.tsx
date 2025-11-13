'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Copy,
  DollarSign,
  TrendingDown,
  Users,
  Info,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BalanceDisplay } from './BalanceDisplay';

interface SettlementViewProps {
  tripId: string;
  currentUserId: string;
}

export function SettlementView({ tripId, currentUserId }: SettlementViewProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['settlements', tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/settlements`);
      if (!response.ok) {
        throw new Error('Failed to fetch settlements');
      }
      return response.json();
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (settlement: {
      fromUserId: string;
      toUserId: string;
      amount: number;
      paymentMethod?: string;
      paymentReference?: string;
    }) => {
      const response = await fetch(`/api/trips/${tripId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlement),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark as paid');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', tripId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      toast.success('Payment marked as complete!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copied!');
  };

  const handleMarkAsPaid = (settlement: any) => {
    const settlementKey = `${settlement.from}-${settlement.to}`;
    markAsPaidMutation.mutate({
      fromUserId: settlement.from,
      toUserId: settlement.to,
      amount: settlement.amount,
      paymentMethod: selectedPaymentMethod[settlementKey],
      paymentReference: paymentReferences[settlementKey],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load settlements. Please try again.</p>
      </div>
    );
  }

  const {
    balances = [],
    suggestedSettlements = [],
    existingSettlements = [],
    totalExpenses = 0,
    stats = {},
    savings = {},
  } = data || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Trip Expenses</p>
          <p className="text-3xl font-bold">${totalExpenses.toFixed(2)}</p>
        </div>

        {/* Transactions Required */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">Transactions Required</p>
          <p className="text-3xl font-bold">{suggestedSettlements.length}</p>
          {savings.naiveCount > 0 && (
            <p className="text-xs opacity-75 mt-1">
              {savings.saved} saved ({savings.savingsPercentage.toFixed(0)}% reduction)
            </p>
          )}
        </div>

        {/* People Involved */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">People Involved</p>
          <p className="text-3xl font-bold">{balances.length}</p>
        </div>
      </div>

      {/* Algorithm Info */}
      {savings.naiveCount > 0 && suggestedSettlements.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Smart Settlement Algorithm</p>
              <p>
                Our algorithm minimized transactions from {savings.naiveCount} to{' '}
                {suggestedSettlements.length}, saving {savings.saved} transaction
                {savings.saved !== 1 ? 's' : ''} ({savings.savingsPercentage.toFixed(1)}%
                reduction).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Balances */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Individual Balances</h3>
        <BalanceDisplay balances={balances} currentUserId={currentUserId} />
      </div>

      {/* Suggested Settlements */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Suggested Payments</h3>
        {suggestedSettlements.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-green-900 mb-1">
              All Settled!
            </h4>
            <p className="text-green-700">No payments needed - everyone is even.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestedSettlements.map((settlement: any, index: number) => {
              const settlementKey = `${settlement.from}-${settlement.to}`;
              const isCurrentUserPayer = settlement.from === currentUserId;

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-5 transition ${
                    isCurrentUserPayer
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:shadow-md'
                  }`}
                >
                  {/* Settlement Details */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="font-semibold text-gray-900">
                        {settlement.fromUser.fullName || settlement.fromUser.email}
                      </div>
                      <ArrowRight className="text-gray-400 flex-shrink-0" />
                      <div className="font-semibold text-gray-900">
                        {settlement.toUser.fullName || settlement.toUser.email}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 ml-4">
                      ${settlement.amount.toFixed(2)}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => handleCopyEmail(settlement.toUser.email)}
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
                    >
                      <Copy size={14} />
                      {settlement.toUser.email}
                    </button>
                  </div>

                  {/* Payment Method Selection (for payer) */}
                  {isCurrentUserPayer && (
                    <div className="space-y-3 mb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Payment Method
                          </label>
                          <select
                            value={selectedPaymentMethod[settlementKey] || ''}
                            onChange={(e) =>
                              setSelectedPaymentMethod({
                                ...selectedPaymentMethod,
                                [settlementKey]: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select method</option>
                            <option value="Venmo">Venmo</option>
                            <option value="PayPal">PayPal</option>
                            <option value="Zelle">Zelle</option>
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Reference (optional)
                          </label>
                          <input
                            type="text"
                            value={paymentReferences[settlementKey] || ''}
                            onChange={(e) =>
                              setPaymentReferences({
                                ...paymentReferences,
                                [settlementKey]: e.target.value,
                              })
                            }
                            placeholder="@username, etc."
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mark as Paid Button (for payer) */}
                  {isCurrentUserPayer && (
                    <button
                      onClick={() => handleMarkAsPaid(settlement)}
                      disabled={markAsPaidMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                    >
                      <Check size={18} />
                      Mark as Paid
                    </button>
                  )}

                  {/* Waiting message (for recipient) */}
                  {!isCurrentUserPayer && (
                    <div className="text-sm text-gray-600 italic">
                      Waiting for {settlement.fromUser.fullName || 'payer'} to mark as paid
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Existing Settlements (Paid) */}
      {existingSettlements.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Payment History</h3>
          <div className="space-y-3">
            {existingSettlements.map((settlement: any) => (
              <div
                key={settlement.id}
                className="border border-green-200 bg-green-50 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {settlement.fromUser?.fullName || 'Someone'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {settlement.toUser?.fullName || 'Someone'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {settlement.paymentMethod && (
                          <span>via {settlement.paymentMethod} • </span>
                        )}
                        {new Date(settlement.paidAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    ${settlement.amount.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold mb-3">How to Settle</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            Send payment to the specified person using your preferred method (Venmo, PayPal,
            etc.)
          </li>
          <li>Include a reference to the trip name in your payment note</li>
          <li>Click "Mark as Paid" after completing the transfer</li>
          <li>The recipient will be notified of the payment</li>
        </ol>
      </div>
    </div>
  );
}
