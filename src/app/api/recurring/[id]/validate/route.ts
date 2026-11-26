import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMonthKey } from '@/core';

/**
 * One-click validation of a recurring payment once debited:
 * Atomically marks the recurring payment as paid for `billingMonth`
 * AND creates the corresponding EXPENSE transaction.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const billingMonth: string =
      typeof body.billingMonth === 'string' && /^\d{4}-\d{2}$/.test(body.billingMonth)
        ? body.billingMonth
        : getMonthKey(new Date());

    const payment = await prisma.recurringPayment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: 'Échéance introuvable.' }, { status: 404 });
    }

    // Prevent duplicate validation for the same month
    const existingTx = await prisma.transaction.findFirst({
      where: { recurringPaymentId: id, billingMonth },
    });

    if (existingTx || payment.lastPaidMonth === billingMonth) {
      return NextResponse.json(
        { error: 'Cette échéance est déjà validée pour ce mois.' },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.recurringPayment.update({
        where: { id },
        data: { lastPaidMonth: billingMonth },
      });

      const createdTx = await tx.transaction.create({
        data: {
          amount: payment.amount,
          type: payment.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          date: new Date(),
          note: payment.note ? `${payment.title} — ${payment.note}` : payment.title,
          categoryId: payment.categoryId,
          recurringPaymentId: payment.id,
          billingMonth,
        },
      });

      return { updatedPayment, createdTx };
    });

    return NextResponse.json({
      recurringPayment: result.updatedPayment,
      transaction: {
        ...result.createdTx,
        date: result.createdTx.date.toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /api/recurring/[id]/validate error:', error);
    return NextResponse.json(
      { error: "Impossible de valider le débit de cette échéance." },
      { status: 500 }
    );
  }
}
