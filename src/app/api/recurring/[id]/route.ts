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
      title?: string;
      amount?: number;
      type?: string;
      isTaxable?: boolean;
      dayOfMonth?: number;
      categoryId?: string;
      isActive?: boolean;
      note?: string | null;
      lastPaidMonth?: string | null;
    } = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim();
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (Number.isFinite(amount) && amount > 0) {
        data.amount = Math.round(amount * 100) / 100;
      }
    }
    if (body.type === 'EXPENSE' || body.type === 'INCOME') {
      data.type = body.type;
    }
    if (typeof body.isTaxable === 'boolean') {
      data.isTaxable = body.isTaxable;
    }
    if (body.dayOfMonth !== undefined) {
      const day = Math.round(Number(body.dayOfMonth));
      if (Number.isFinite(day)) {
        data.dayOfMonth = Math.min(31, Math.max(1, day));
      }
    }
    if (typeof body.categoryId === 'string' && body.categoryId) {
      data.categoryId = body.categoryId;
    }
    if (typeof body.isActive === 'boolean') {
      data.isActive = body.isActive;
    }
    if (body.note !== undefined) {
      data.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    }
    if (body.lastPaidMonth !== undefined) {
      data.lastPaidMonth = body.lastPaidMonth;
    }

    const updated = await prisma.recurringPayment.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/recurring/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de modifier cette échéance.' },
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
    await prisma.recurringPayment.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/recurring/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer cette échéance.' },
      { status: 500 }
    );
  }
}
