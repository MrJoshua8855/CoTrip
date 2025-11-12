# Expense Tracking Implementation Guide

## Overview
Implement comprehensive expense tracking with flexible splitting options, receipt management, and automatic balance calculations.

## Split Types
1. **Equal**: Split evenly among all members
2. **Percentage**: Custom percentage for each member
3. **Amount**: Specific amounts for each member
4. **Opt-in**: Split among opted-in members only

## Implementation Steps

### Step 1: Create Expense API Routes

#### File: `src/app/api/trips/[tripId]/expenses/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { calculateExpenseSplits } from '@/lib/expenses';

const createExpenseSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  category: z.string().optional(),
  description: z.string().min(1),
  receiptUrl: z.string().url().optional(),
  expenseDate: z.string().datetime().optional(),
  splitType: z.enum(['equal', 'percentage', 'amount', 'opt_in']).default('equal'),
  splits: z.array(z.object({
    userId: z.string(),
    amount: z.number().optional(),
    percentage: z.number().optional(),
  })).optional(),
  relatedProposalId: z.string().optional(),
  relatedFeatureId: z.string().optional(),
});

// GET /api/trips/[tripId]/expenses
export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expenses = await prisma.expense.findMany({
      where: { tripId: params.tripId },
      include: {
        paidBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        relatedProposal: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

// POST /api/trips/[tripId]/expenses
export async function POST(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = createExpenseSchema.parse(body);

    // Get trip members
    const members = await prisma.tripMember.findMany({
      where: {
        tripId: params.tripId,
        status: 'active',
      },
    });

    // Calculate splits based on type
    const splits = calculateExpenseSplits(
      validated.amount,
      validated.splitType,
      members,
      validated.splits
    );

    // Validate splits sum to total
    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplit - validated.amount) > 0.01) {
      return NextResponse.json(
        { error: 'Splits do not sum to total amount' },
        { status: 400 }
      );
    }

    // Create expense with splits
    const expense = await prisma.expense.create({
      data: {
        tripId: params.tripId,
        paidById: session.user.id,
        amount: validated.amount,
        currency: validated.currency,
        category: validated.category,
        description: validated.description,
        receiptUrl: validated.receiptUrl,
        expenseDate: validated.expenseDate || new Date(),
        splitType: validated.splitType,
        relatedProposalId: validated.relatedProposalId,
        relatedFeatureId: validated.relatedFeatureId,
        splits: {
          create: splits.map(split => ({
            userId: split.userId,
            amount: split.amount,
            percentage: split.percentage,
          })),
        },
      },
      include: {
        paidBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Create notifications
    await prisma.notification.createMany({
      data: members
        .filter(m => m.userId !== session.user.id)
        .map(m => ({
          userId: m.userId,
          tripId: params.tripId,
          type: 'new_expense',
          title: 'New Expense',
          message: `${session.user.name} added expense: ${validated.description}`,
          data: { expenseId: expense.id },
        })),
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
```

### Step 2: Create Split Calculation Utility

#### File: `src/lib/expenses.ts`
```typescript
interface TripMember {
  userId: string;
  costPercentage?: number | null;
}

interface CustomSplit {
  userId: string;
  amount?: number;
  percentage?: number;
}

export function calculateExpenseSplits(
  totalAmount: number,
  splitType: string,
  members: TripMember[],
  customSplits?: CustomSplit[]
) {
  switch (splitType) {
    case 'equal':
      return calculateEqualSplit(totalAmount, members);

    case 'percentage':
      return calculatePercentageSplit(totalAmount, members, customSplits);

    case 'amount':
      return calculateAmountSplit(totalAmount, members, customSplits);

    case 'opt_in':
      return calculateOptInSplit(totalAmount, members, customSplits);

    default:
      throw new Error('Invalid split type');
  }
}

function calculateEqualSplit(totalAmount: number, members: TripMember[]) {
  const perPerson = totalAmount / members.length;

  return members.map(member => ({
    userId: member.userId,
    amount: perPerson,
    percentage: (100 / members.length),
  }));
}

function calculatePercentageSplit(
  totalAmount: number,
  members: TripMember[],
  customSplits?: CustomSplit[]
) {
  if (!customSplits || customSplits.length === 0) {
    // Use trip default percentages if available
    const totalPercentage = members.reduce(
      (sum, m) => sum + (m.costPercentage?.toNumber() || 0),
      0
    );

    if (totalPercentage > 0) {
      return members.map(member => {
        const percentage = member.costPercentage?.toNumber() || 0;
        return {
          userId: member.userId,
          amount: (totalAmount * percentage) / 100,
          percentage,
        };
      });
    }

    // Fallback to equal split
    return calculateEqualSplit(totalAmount, members);
  }

  // Use custom percentages
  return customSplits.map(split => ({
    userId: split.userId,
    amount: (totalAmount * (split.percentage || 0)) / 100,
    percentage: split.percentage || 0,
  }));
}

function calculateAmountSplit(
  totalAmount: number,
  members: TripMember[],
  customSplits?: CustomSplit[]
) {
  if (!customSplits || customSplits.length === 0) {
    throw new Error('Custom amounts required for amount split');
  }

  return customSplits.map(split => {
    const amount = split.amount || 0;
    return {
      userId: split.userId,
      amount,
      percentage: (amount / totalAmount) * 100,
    };
  });
}

function calculateOptInSplit(
  totalAmount: number,
  members: TripMember[],
  customSplits?: CustomSplit[]
) {
  // Only split among users who opted in (provided in customSplits)
  if (!customSplits || customSplits.length === 0) {
    return [];
  }

  const perPerson = totalAmount / customSplits.length;

  return customSplits.map(split => ({
    userId: split.userId,
    amount: perPerson,
    percentage: (100 / customSplits.length),
  }));
}

/**
 * Calculate user balances for a trip
 */
export async function calculateTripBalances(tripId: string) {
  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      splits: true,
    },
  });

  const balances = new Map<string, number>();

  expenses.forEach(expense => {
    // Add amount paid
    const currentPaid = balances.get(expense.paidById!) || 0;
    balances.set(expense.paidById!, currentPaid + expense.amount.toNumber());

    // Subtract amounts owed
    expense.splits.forEach(split => {
      const currentOwed = balances.get(split.userId) || 0;
      balances.set(split.userId, currentOwed - split.amount.toNumber());
    });
  });

  return Array.from(balances.entries()).map(([userId, balance]) => ({
    userId,
    balance,
  }));
}
```

### Step 3: Create Receipt Upload Utility

#### File: `src/lib/upload.ts`
```typescript
/**
 * Upload receipt image to cloud storage (Cloudinary example)
 */
export async function uploadReceipt(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET!);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload receipt');
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Validate receipt file
 */
export function validateReceiptFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload JPG, PNG, or PDF.');
  }

  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  return true;
}
```

### Step 4: Create Expense Form Component

#### File: `src/components/expenses/ExpenseForm.tsx`
```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { uploadReceipt } from '@/lib/upload';

const expenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().optional(),
  splitType: z.enum(['equal', 'percentage', 'amount', 'opt_in']),
  expenseDate: z.string().optional(),
});

interface ExpenseFormProps {
  tripId: string;
  members: any[];
  onSuccess?: () => void;
}

export function ExpenseForm({ tripId, members, onSuccess }: ExpenseFormProps) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      splitType: 'equal',
    },
  });

  const splitType = watch('splitType');

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      let receiptUrl;

      if (receiptFile) {
        setUploadingReceipt(true);
        receiptUrl = await uploadReceipt(receiptFile);
        setUploadingReceipt(false);
      }

      const response = await fetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          receiptUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create expense');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      onSuccess?.();
    },
  });

  const onSubmit = (data: any) => {
    createExpenseMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block mb-2">Amount</label>
        <input
          type="number"
          step="0.01"
          {...register('amount', { valueAsNumber: true })}
          className="w-full p-2 border rounded"
        />
        {errors.amount && (
          <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
        )}
      </div>

      <div>
        <label className="block mb-2">Description</label>
        <input
          type="text"
          {...register('description')}
          className="w-full p-2 border rounded"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block mb-2">Category</label>
        <select {...register('category')} className="w-full p-2 border rounded">
          <option value="">Select category</option>
          <option value="accommodation">Accommodation</option>
          <option value="food">Food</option>
          <option value="transportation">Transportation</option>
          <option value="activities">Activities</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block mb-2">Split Type</label>
        <select {...register('splitType')} className="w-full p-2 border rounded">
          <option value="equal">Equal split</option>
          <option value="percentage">Percentage split</option>
          <option value="amount">Custom amounts</option>
          <option value="opt_in">Opt-in only</option>
        </select>
      </div>

      <div>
        <label className="block mb-2">Receipt (optional)</label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="hidden"
            id="receipt-upload"
          />
          <label
            htmlFor="receipt-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="mb-2" />
            {receiptFile ? (
              <span>{receiptFile.name}</span>
            ) : (
              <span>Click to upload receipt</span>
            )}
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={createExpenseMutation.isPending || uploadingReceipt}
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {uploadingReceipt ? 'Uploading receipt...' :
         createExpenseMutation.isPending ? 'Adding expense...' :
         'Add Expense'}
      </button>
    </form>
  );
}
```

## Testing Checklist

- [ ] Create expense with equal split
- [ ] Create expense with percentage split
- [ ] Create expense with custom amounts
- [ ] Create expense with opt-in split
- [ ] Upload receipt (image and PDF)
- [ ] Edit existing expense
- [ ] Delete expense
- [ ] View expense details
- [ ] Filter expenses by category
- [ ] Export expense report
- [ ] Balance calculations are correct

## Advanced Features

1. **OCR Receipt Scanning**
   - Auto-extract amount, date, merchant
   - Use Google Vision API or Tesseract

2. **Recurring Expenses**
   - Set up recurring expenses
   - Auto-create on schedule

3. **Budget Tracking**
   - Set category budgets
   - Alert when approaching limit
   - Budget vs actual reports

4. **Currency Conversion**
   - Support multiple currencies
   - Auto-convert at current rates
   - Historical rate tracking

5. **Expense Analytics**
   - Spending patterns
   - Category breakdowns
   - Per-person spending
   - Cost trends over time