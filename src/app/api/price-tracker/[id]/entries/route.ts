import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const price = Number(body.price);
    const store =
      typeof body.store === 'string' && body.store.trim() ? body.store.trim() : null;
    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Le prix doit être supérieur à 0 €.' },
        { status: 400 }
      );
    }
    if (Number.isNaN(recordedAt.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
    }

    const created = await prisma.priceEntry.create({
      data: {
        productId: id,
        price: Math.round(price * 100) / 100,
        store,
        recordedAt,
      },
    });

    return NextResponse.json(
      { ...created, recordedAt: created.recordedAt.toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/price-tracker/[id]/entries error:', error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer ce relevé de prix." },
      { status: 500 }
    );
  }
}
