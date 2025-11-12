'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, DollarSign, Calendar, Tag, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const customSplitSchema = z.object({
  userId: z.string(),
  amount: z.number().optional(),
  percentage: z.number().optional(),
});

const expenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().optional(),
  splitType: z.enum(['equal', 'percentage', 'amount', 'opt_in']),
  expenseDate: z.string().optional(),
  splits: z.array(customSplitSchema).optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface Member {
  id: string;
  userId: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  };
}

interface ExpenseFormProps {
  tripId: string;
  members: Member[];
  onSuccess?: () => void;
  onCancel?: () => void;
  expense?: any; // For editing existing expense
}

export function ExpenseForm({
  tripId,
  members,
  onSuccess,
  onCancel,
  expense,
}: ExpenseFormProps) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(
    expense?.receiptUrl || null
  );
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [splitPercentages, setSplitPercentages] = useState<Record<string, number>>({});
  const [optedInUsers, setOptedInUsers] = useState<Set<string>>(
    new Set(members.map((m) => m.userId))
  );

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      splitType: expense?.splitType || 'equal',
      amount: expense?.amount || undefined,
      description: expense?.description || '',
      category: expense?.category || '',
      expenseDate: expense?.expenseDate
        ? new Date(expense.expenseDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    },
  });

  const splitType = watch('splitType');
  const amount = watch('amount');

  // Initialize split data for editing
  useEffect(() => {
    if (expense?.splits) {
      const amounts: Record<string, number> = {};
      const percentages: Record<string, number> = {};
      const opted = new Set<string>();

      expense.splits.forEach((split: any) => {
        amounts[split.userId] = split.amount;
        if (split.percentage) {
          percentages[split.userId] = split.percentage;
        }
        opted.add(split.userId);
      });

      setSplitAmounts(amounts);
      setSplitPercentages(percentages);
      if (expense.splitType === 'opt_in') {
        setOptedInUsers(opted);
      }
    }
  }, [expense]);

  const uploadReceiptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/expenses/upload-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload receipt');
      }

      return response.json();
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData & { receiptUrl?: string }) => {
      const url = expense
        ? `/api/expenses/${expense.id}`
        : `/api/trips/${tripId}/expenses`;

      const method = expense ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save expense');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['settlements', tripId] });
      toast.success(expense ? 'Expense updated!' : 'Expense added!');
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      let receiptUrl = receiptPreview;

      // Upload receipt if new file selected
      if (receiptFile) {
        setUploadingReceipt(true);
        const uploadResult = await uploadReceiptMutation.mutateAsync(receiptFile);
        receiptUrl = uploadResult.url;
        setUploadingReceipt(false);
      }

      // Prepare splits based on type
      let splits;
      if (splitType === 'percentage') {
        splits = Object.entries(splitPercentages)
          .filter(([_, pct]) => pct > 0)
          .map(([userId, percentage]) => ({ userId, percentage }));
      } else if (splitType === 'amount') {
        splits = Object.entries(splitAmounts)
          .filter(([_, amt]) => amt > 0)
          .map(([userId, amount]) => ({ userId, amount }));
      } else if (splitType === 'opt_in') {
        splits = Array.from(optedInUsers).map((userId) => ({ userId }));
      }

      await createExpenseMutation.mutateAsync({
        ...data,
        receiptUrl,
        splits,
      });
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  // Calculate per-person amount for preview
  const calculatePerPersonAmount = () => {
    if (!amount) return 0;

    if (splitType === 'equal') {
      return amount / members.length;
    } else if (splitType === 'opt_in') {
      return amount / optedInUsers.size;
    } else if (splitType === 'percentage') {
      const total = Object.values(splitPercentages).reduce((sum, pct) => sum + pct, 0);
      return total > 0 ? amount / (total / 100) : 0;
    }
    return 0;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <DollarSign className="inline w-4 h-4 mr-1" />
          Amount *
        </label>
        <input
          type="number"
          step="0.01"
          {...register('amount', { valueAsNumber: true })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0.00"
        />
        {errors.amount && (
          <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FileText className="inline w-4 h-4 mr-1" />
          Description *
        </label>
        <input
          type="text"
          {...register('description')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="What was this expense for?"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Category and Date Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Tag className="inline w-4 h-4 mr-1" />
            Category
          </label>
          <select
            {...register('category')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select category</option>
            <option value="accommodation">Accommodation</option>
            <option value="food">Food & Dining</option>
            <option value="transportation">Transportation</option>
            <option value="activities">Activities</option>
            <option value="shopping">Shopping</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            Date
          </label>
          <input
            type="date"
            {...register('expenseDate')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Split Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Split Type
        </label>
        <select
          {...register('splitType')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="equal">Split equally</option>
          <option value="percentage">Split by percentage</option>
          <option value="amount">Split by exact amounts</option>
          <option value="opt_in">Opt-in only</option>
        </select>
      </div>

      {/* Split Configuration */}
      {splitType === 'percentage' && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Percentage Split</h4>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-2">
                <span className="flex-1 text-sm">
                  {member.user.fullName || member.user.email}
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={splitPercentages[member.userId] || 0}
                  onChange={(e) =>
                    setSplitPercentages({
                      ...splitPercentages,
                      [member.userId]: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24 px-2 py-1 border rounded"
                  placeholder="0"
                />
                <span className="text-sm">%</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Total:{' '}
            {Object.values(splitPercentages).reduce((sum, pct) => sum + pct, 0).toFixed(2)}%
            {Math.abs(Object.values(splitPercentages).reduce((sum, pct) => sum + pct, 0) - 100) > 0.01 && (
              <span className="text-red-500 ml-2">Must equal 100%</span>
            )}
          </div>
        </div>
      )}

      {splitType === 'amount' && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Amount Split</h4>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-2">
                <span className="flex-1 text-sm">
                  {member.user.fullName || member.user.email}
                </span>
                <span className="text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitAmounts[member.userId] || 0}
                  onChange={(e) =>
                    setSplitAmounts({
                      ...splitAmounts,
                      [member.userId]: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24 px-2 py-1 border rounded"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Total: ${Object.values(splitAmounts).reduce((sum, amt) => sum + amt, 0).toFixed(2)}
            {amount && Math.abs(Object.values(splitAmounts).reduce((sum, amt) => sum + amt, 0) - amount) > 0.01 && (
              <span className="text-red-500 ml-2">
                Must equal ${amount.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {splitType === 'opt_in' && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Who's Participating?</h4>
          <div className="space-y-2">
            {members.map((member) => (
              <label key={member.userId} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optedInUsers.has(member.userId)}
                  onChange={(e) => {
                    const newSet = new Set(optedInUsers);
                    if (e.target.checked) {
                      newSet.add(member.userId);
                    } else {
                      newSet.delete(member.userId);
                    }
                    setOptedInUsers(newSet);
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{member.user.fullName || member.user.email}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {optedInUsers.size} participant{optedInUsers.size !== 1 ? 's' : ''}
            {amount && optedInUsers.size > 0 && (
              <span className="ml-2">
                (${(amount / optedInUsers.size).toFixed(2)} each)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Split Preview */}
      {amount && splitType === 'equal' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ${calculatePerPersonAmount().toFixed(2)} per person ({members.length} people)
          </p>
        </div>
      )}

      {/* Receipt Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Upload className="inline w-4 h-4 mr-1" />
          Receipt (optional)
        </label>
        {receiptPreview ? (
          <div className="relative inline-block">
            <img
              src={receiptPreview}
              alt="Receipt preview"
              className="w-full max-w-xs h-48 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={handleRemoveReceipt}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="receipt-upload"
            />
            <label htmlFor="receipt-upload" className="cursor-pointer">
              <Upload className="mx-auto mb-2 text-gray-400" size={32} />
              <p className="text-sm text-gray-600">
                Click to upload receipt (JPG, PNG, PDF)
              </p>
              <p className="text-xs text-gray-400 mt-1">Max 10MB</p>
            </label>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={createExpenseMutation.isPending || uploadingReceipt}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {uploadingReceipt
            ? 'Uploading receipt...'
            : createExpenseMutation.isPending
            ? expense ? 'Updating...' : 'Adding...'
            : expense ? 'Update Expense' : 'Add Expense'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
