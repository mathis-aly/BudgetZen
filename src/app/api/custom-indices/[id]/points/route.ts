import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const value = Number(body.value);
    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { error: "La valeur de l'indice doit être supérieure à 0." },
        { status: 400 }
      );
    }
    if (Number.isNaN(recordedAt.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
    }

    const created = await prisma.indexDataPoint.create({
      data: {
        indexId: id,
        value: Math.round(value * 100) / 100,
        recordedAt,
      },
    });

    return NextResponse.json(
      { ...created, recordedAt: created.recordedAt.toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/custom-indices/[id]/points error:', error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer ce point d'indice." },
      { status: 500 }
    );
  }
}
