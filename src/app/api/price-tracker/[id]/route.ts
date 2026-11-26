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
      name?: string;
      unit?: string;
      targetAlertPercent?: number;
    } = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.unit === 'string' && body.unit.trim()) {
      data.unit = body.unit.trim();
    }
    if (body.targetAlertPercent !== undefined) {
      const val = Number(body.targetAlertPercent);
      if (Number.isFinite(val) && val > 0) {
        data.targetAlertPercent = Math.round(Math.min(100, Math.max(0.5, val)) * 10) / 10;
      }
    }

    const updated = await prisma.trackedProduct.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/price-tracker/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de modifier ce produit.' },
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
    await prisma.trackedProduct.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/price-tracker/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer ce produit.' },
      { status: 500 }
    );
  }
}
