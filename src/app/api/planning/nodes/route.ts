import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_TYPES = new Set(['IDEA', 'RESOURCE', 'GOAL']);
const VALID_RESOURCE_KINDS = new Set(['YOUTUBE', 'ARTICLE']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
    const title = rawTitle || 'Nouvelle idée';
    const type = VALID_TYPES.has(body.type) ? body.type : 'IDEA';
    const content =
      typeof body.content === 'string' && body.content.trim()
        ? body.content.trim()
        : null;
    const url =
      typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null;
    const resourceKind = VALID_RESOURCE_KINDS.has(body.resourceKind)
      ? body.resourceKind
      : null;
    const positionX = Number.isFinite(Number(body.positionX))
      ? Number(body.positionX)
      : 0;
    const positionY = Number.isFinite(Number(body.positionY))
      ? Number(body.positionY)
      : 0;

    const created = await prisma.planningNode.create({
      data: {
        type,
        title,
        content,
        url,
        resourceKind,
        positionX,
        positionY,
      },
    });

    return NextResponse.json(
      {
        ...created,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/planning/nodes error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer ce nœud de planification.' },
      { status: 500 }
    );
  }
}
