import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const data: {
      amount?: number;
      type?: string;
      categoryId?: string;
      date?: Date;
      note?: string | null;
    } = {};

    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
      }
      data.amount = Math.round(amount * 100) / 100;
    }
    if (body.type === 'EXPENSE' || body.type === 'INCOME') {
      data.type = body.type;
    }
    if (typeof body.categoryId === 'string' && body.categoryId) {
      data.categoryId = body.categoryId;
    }
    if (body.date) {
      const d = new Date(body.date);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
      }
      data.date = d;
    }
    if (body.note !== undefined) {
      data.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...updated,
      date: updated.date.toISOString(),
    });
  } catch (error) {
    console.error('PATCH /api/transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de modifier cette transaction.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // If this transaction was created from validating a recurring payment, reset lastPaidMonth if needed
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });

      if (existing.recurringPaymentId && existing.billingMonth) {
        const recurring = await tx.recurringPayment.findUnique({
          where: { id: existing.recurringPaymentId },
        });
        if (recurring && recurring.lastPaidMonth === existing.billingMonth) {
          await tx.recurringPayment.update({
            where: { id: recurring.id },
            data: { lastPaidMonth: null },
          });
        }
      }
    });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer cette transaction.' },
      { status: 500 }
    );
  }
}
