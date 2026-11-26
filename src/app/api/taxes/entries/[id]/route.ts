import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = new Set(['INCOME', 'CAPITAL', 'LOCAL', 'OTHER']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const data: {
      year?: number;
      category?: string;
      label?: string;
      taxableBase?: number;
      computedTax?: number;
      notes?: string | null;
    } = {};

    if (body.year !== undefined) data.year = Math.round(Number(body.year));
    if (typeof body.category === 'string' && VALID_CATEGORIES.has(body.category)) {
      data.category = body.category;
    }
    if (typeof body.label === 'string' && body.label.trim()) {
      data.label = body.label.trim();
    }
    if (body.taxableBase !== undefined) {
      const val = Number(body.taxableBase);
      if (Number.isFinite(val) && val >= 0) data.taxableBase = Math.round(val * 100) / 100;
    }
    if (body.computedTax !== undefined) {
      const val = Number(body.computedTax);
      if (Number.isFinite(val) && val >= 0) data.computedTax = Math.round(val * 100) / 100;
    }
    if (body.notes !== undefined) {
      data.notes =
        typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    }

    const updated = await prisma.taxEntry.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/taxes/entries/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de modifier ce poste fiscal.' },
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
    await prisma.taxEntry.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/taxes/entries/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer ce poste fiscal.' },
      { status: 500 }
    );
  }
}
