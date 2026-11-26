import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_TYPES = new Set(['IDEA', 'RESOURCE', 'GOAL']);
const VALID_RESOURCE_KINDS = new Set(['YOUTUBE', 'ARTICLE']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const existing = await prisma.planningNode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Nœud introuvable.' }, { status: 404 });
    }

    const data: {
      title?: string;
      content?: string | null;
      type?: string;
      url?: string | null;
      resourceKind?: string | null;
      positionX?: number;
      positionY?: number;
    } = {};

    if (typeof body.title === 'string') {
      data.title = body.title.trim() || 'Sans titre';
    }
    if (body.content !== undefined) {
      data.content =
        typeof body.content === 'string' && body.content.trim()
          ? body.content.trim()
          : null;
    }
    if (typeof body.type === 'string' && VALID_TYPES.has(body.type)) {
      data.type = body.type;
    }
    if (body.url !== undefined) {
      data.url =
        typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null;
    }
    if (body.resourceKind !== undefined) {
      data.resourceKind = VALID_RESOURCE_KINDS.has(body.resourceKind)
        ? body.resourceKind
        : null;
    }
    if (body.positionX !== undefined) {
      const px = Number(body.positionX);
      if (Number.isFinite(px)) data.positionX = px;
    }
    if (body.positionY !== undefined) {
      const py = Number(body.positionY);
      if (Number.isFinite(py)) data.positionY = py;
    }

    const updated = await prisma.planningNode.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('PATCH /api/planning/nodes/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour ce nœud.' },
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
    await prisma.planningNode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/planning/nodes/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer ce nœud.' },
      { status: 500 }
    );
  }
}
