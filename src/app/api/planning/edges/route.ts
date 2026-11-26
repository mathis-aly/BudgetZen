import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim()
        : null;

    if (!sourceId || !targetId || sourceId === targetId) {
      return NextResponse.json(
        { error: 'Connexion invalide entre deux nœuds.' },
        { status: 400 }
      );
    }

    const existing = await prisma.planningEdge.findFirst({
      where: { sourceId, targetId },
    });
    if (existing) {
      return NextResponse.json(existing);
    }

    const created = await prisma.planningEdge.create({
      data: {
        sourceId,
        targetId,
        label,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/planning/edges error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer cette connexion.' },
      { status: 500 }
    );
  }
}
