import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountName, currentBalance, initialBalance, monthlyIncomeTarget } = body;

    let nextInitialBalance: number | undefined =
      typeof initialBalance === 'number' && Number.isFinite(initialBalance)
        ? initialBalance
        : undefined;

    // If user directly sets their current bank balance, recompute initialBalance so
    // initialBalance + sum(INCOME) - sum(EXPENSE) - sum(ReserveExpense) === currentBalance
    if (typeof currentBalance === 'number' && Number.isFinite(currentBalance)) {
      const [txs, reserveExps] = await Promise.all([
        prisma.transaction.findMany({ select: { amount: true, type: true } }),
        prisma.reserveExpense.findMany({ select: { amount: true } }),
      ]);
      const netFlow =
        txs.reduce((acc, tx) => acc + (tx.type === 'INCOME' ? tx.amount : -tx.amount), 0) -
        reserveExps.reduce((acc, exp) => acc + exp.amount, 0);
      nextInitialBalance = Math.round((currentBalance - netFlow) * 100) / 100;
    }

    const updated = await prisma.accountSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(typeof accountName === 'string' && accountName.trim()
          ? { accountName: accountName.trim() }
          : {}),
        ...(nextInitialBalance !== undefined ? { initialBalance: nextInitialBalance } : {}),
        ...(typeof monthlyIncomeTarget === 'number' && Number.isFinite(monthlyIncomeTarget)
          ? { monthlyIncomeTarget: Math.max(0, monthlyIncomeTarget) }
          : {}),
      },
      create: {
        id: 'default',
        accountName: typeof accountName === 'string' && accountName.trim() ? accountName.trim() : 'Compte Courant',
        initialBalance: nextInitialBalance ?? 0,
        currency: 'EUR',
        monthlyIncomeTarget:
          typeof monthlyIncomeTarget === 'number' && Number.isFinite(monthlyIncomeTarget)
            ? Math.max(0, monthlyIncomeTarget)
            : 2800,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour les paramètres du compte.' },
      { status: 500 }
    );
  }
}
