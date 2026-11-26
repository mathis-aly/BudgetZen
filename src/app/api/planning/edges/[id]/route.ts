import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim()
        : null;

    const updated = await prisma.planningEdge.update({
      where: { id },
      data: { label },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/planning/edges/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour cette connexion.' },
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
    await prisma.planningEdge.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/planning/edges/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer cette connexion.' },
      { status: 500 }
    );
  }
}
