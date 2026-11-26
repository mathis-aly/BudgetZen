import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Quick manual value refresh ("Actualiser la valeur"):
 * Updates currentValue & lastUpdated AND appends a new AssetSnapshot atomically.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const value = Number(body.value);

    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: 'Veuillez saisir une valeur positive valide.' },
        { status: 400 }
      );
    }

    const roundedValue = Math.round(value * 100) / 100;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.wealthAsset.update({
        where: { id },
        data: {
          currentValue: roundedValue,
          lastUpdated: now,
        },
      });

      const snapshot = await tx.assetSnapshot.create({
        data: {
          assetId: id,
          value: roundedValue,
          recordedAt: now,
        },
      });

      return { asset, snapshot };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/wealth/[id]/snapshot error:', error);
    return NextResponse.json(
      { error: "Impossible d'actualiser la valeur de ce support." },
      { status: 500 }
    );
  }
}
