'use client';

import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Balance {
  userId: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  paid: number;
  owed: number;
  balance: number;
}

interface BalanceDisplayProps {
  balances: Balance[];
  currentUserId?: string;
}

export function BalanceDisplay({ balances, currentUserId }: BalanceDisplayProps) {
  // Sort balances: current user first, then by balance (highest to lowest)
  const sortedBalances = [...balances].sort((a, b) => {
    if (currentUserId) {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
    }
    return b.balance - a.balance;
  });

  const maxAbsBalance = Math.max(...balances.map((b) => Math.abs(b.balance)));

  const getBalanceColor = (balance: number) => {
    if (balance > 0.01) return 'text-green-600';
    if (balance < -0.01) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBalanceBgColor = (balance: number) => {
    if (balance > 0.01) return 'bg-green-100 border-green-300';
    if (balance < -0.01) return 'bg-red-100 border-red-300';
    return 'bg-gray-100 border-gray-300';
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0.01) return <TrendingUp className="w-5 h-5" />;
    if (balance < -0.01) return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const getBalanceLabel = (balance: number) => {
    if (balance > 0.01) return 'Gets back';
    if (balance < -0.01) return 'Owes';
    return 'Settled';
  };

  const getBarWidth = (balance: number) => {
    if (maxAbsBalance === 0) return 0;
    return (Math.abs(balance) / maxAbsBalance) * 100;
  };

  if (balances.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <Users className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">No balance data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedBalances.map((balance) => {
        const isCurrentUser = balance.userId === currentUserId;

        return (
          <div
            key={balance.userId}
            className={`border rounded-lg p-4 transition ${
              isCurrentUser
                ? 'border-blue-300 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              {/* User Info */}
              <div className="flex items-center gap-3 flex-1">
                {balance.user.avatarUrl ? (
                  <img
                    src={balance.user.avatarUrl}
                    alt={balance.user.fullName || balance.user.email}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                    {(balance.user.fullName || balance.user.email)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">
                      {balance.user.fullName || balance.user.email}
                    </p>
                    {isCurrentUser && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                    <span>Paid: ${balance.paid.toFixed(2)}</span>
                    <span>•</span>
                    <span>Owes: ${balance.owed.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Balance Amount */}
              <div className="text-right ml-4">
                <div className={`flex items-center gap-1.5 ${getBalanceColor(balance.balance)}`}>
                  {getBalanceIcon(balance.balance)}
                  <span className="text-2xl font-bold">
                    ${Math.abs(balance.balance).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {getBalanceLabel(balance.balance)}
                </p>
              </div>
            </div>

            {/* Balance Bar */}
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`absolute top-0 h-full rounded-full transition-all ${
                  balance.balance > 0
                    ? 'bg-gradient-to-r from-green-400 to-green-600 left-0'
                    : balance.balance < 0
                    ? 'bg-gradient-to-r from-red-400 to-red-600 right-0'
                    : 'bg-gray-400 left-0'
                }`}
                style={{
                  width: `${getBarWidth(balance.balance)}%`,
                  ...(balance.balance < 0 && { right: 0, left: 'auto' }),
                }}
              />
            </div>

            {/* Status Badge */}
            {Math.abs(balance.balance) < 0.01 && (
              <div className="mt-3 flex items-center justify-center">
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  ✓ All Settled
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Paid</p>
            <p className="text-lg font-bold text-gray-900">
              ${balances.reduce((sum, b) => sum + b.paid, 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Owed</p>
            <p className="text-lg font-bold text-gray-900">
              ${balances.reduce((sum, b) => sum + b.owed, 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Net Balance</p>
            <p className="text-lg font-bold text-gray-900">
              ${Math.abs(balances.reduce((sum, b) => sum + b.balance, 0)).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
