import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [nodes, edges] = await Promise.all([
      prisma.planningNode.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.planningEdge.findMany(),
    ]);

    return NextResponse.json({
      nodes: nodes.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      edges,
    });
  } catch (error) {
    console.error('GET /api/planning error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger le canevas de planification.' },
      { status: 500 }
    );
  }
}
