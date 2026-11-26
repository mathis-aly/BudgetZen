import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_CATEGORIES = new Set(['SAVINGS', 'STOCKS', 'REAL_ESTATE', 'OTHER']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.wealthAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Support introuvable.' }, { status: 404 });
    }

    const data: {
      name?: string;
      category?: string;
      currentValue?: number;
      monthlyContribution?: number;
      expectedAnnualYield?: number;
      lastUpdated?: Date;
    } = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.category === 'string' && ALLOWED_CATEGORIES.has(body.category)) {
      data.category = body.category;
    }
    if (body.monthlyContribution !== undefined) {
      const mc = Number(body.monthlyContribution);
      if (Number.isFinite(mc) && mc >= 0) {
        data.monthlyContribution = Math.round(mc * 100) / 100;
      }
    }
    if (body.expectedAnnualYield !== undefined) {
      const y = Number(body.expectedAnnualYield);
      if (Number.isFinite(y)) {
        data.expectedAnnualYield = Math.round(Math.min(50, Math.max(-20, y)) * 100) / 100;
      }
    }

    let valueChanged = false;
    if (body.currentValue !== undefined) {
      const cv = Number(body.currentValue);
      if (Number.isFinite(cv) && cv >= 0) {
        const rounded = Math.round(cv * 100) / 100;
        data.currentValue = rounded;
        valueChanged = rounded !== existing.currentValue;
      }
    }

    const now = new Date();
    data.lastUpdated = now;

    const updated = await prisma.$transaction(async (tx) => {
      const asset = await tx.wealthAsset.update({
        where: { id },
        data,
      });

      if (valueChanged && data.currentValue !== undefined) {
        await tx.assetSnapshot.create({
          data: {
            assetId: id,
            value: data.currentValue,
            recordedAt: now,
          },
        });
      }

      return asset;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/wealth/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de modifier ce support.' },
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
    await prisma.wealthAsset.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/wealth/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer ce support.' },
      { status: 500 }
    );
  }
}
