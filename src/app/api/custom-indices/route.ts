import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_SOURCE_TYPES = new Set([
  'TRACKED_PRODUCT',
  'EXPENSE_CATEGORY',
  'WEALTH_ASSET',
  'MANUAL_SERIES',
]);

export async function GET() {
  try {
    const indices = await prisma.customIndex.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        components: true,
        dataPoints: { orderBy: { recordedAt: 'asc' } },
      },
    });
    return NextResponse.json(indices);
  } catch (error) {
    console.error('GET /api/custom-indices error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les indices personnalisés.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;
    const baseValue = Math.max(1, Number(body.baseValue) || 100.0);
    const type = body.type === 'MANUAL' ? 'MANUAL' : 'COMPOSITE';
    const rawComponents = Array.isArray(body.components) ? body.components : [];

    if (!name) {
      return NextResponse.json(
        { error: "Le nom de l'indice est requis." },
        { status: 400 }
      );
    }

    if (type === 'COMPOSITE') {
      if (rawComponents.length === 0) {
        return NextResponse.json(
          { error: 'Ajoutez au moins une composante pour un indice composite.' },
          { status: 400 }
        );
      }
      const totalWeight = rawComponents.reduce(
        (sum: number, c: { weightPercent?: number }) => sum + (Number(c.weightPercent) || 0),
        0
      );
      if (Math.abs(totalWeight - 100) > 0.05) {
        return NextResponse.json(
          { error: `La somme des pondérations doit être exactement égale à 100 % (actuel : ${totalWeight} %).` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const created = await prisma.customIndex.create({
      data: {
        name,
        description,
        baseValue: Math.round(baseValue * 100) / 100,
        type,
        ...(type === 'COMPOSITE'
          ? {
              components: {
                create: rawComponents.map(
                  (c: {
                    sourceType?: string;
                    sourceId?: string | null;
                    label?: string;
                    weightPercent?: number;
                    baseReferenceValue?: number;
                  }) => ({
                    sourceType: VALID_SOURCE_TYPES.has(c.sourceType ?? '')
                      ? (c.sourceType as string)
                      : 'MANUAL_SERIES',
                    sourceId: c.sourceId || null,
                    label: (c.label || 'Composante').trim(),
                    weightPercent: Math.round((Number(c.weightPercent) || 0) * 100) / 100,
                    baseReferenceValue: Math.max(
                      0.01,
                      Math.round((Number(c.baseReferenceValue) || 1) * 100) / 100
                    ),
                  })
                ),
              },
            }
          : {}),
        dataPoints: {
          create: {
            value: Math.round(baseValue * 100) / 100,
            recordedAt: now,
          },
        },
      },
      include: {
        components: true,
        dataPoints: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/custom-indices error:', error);
    return NextResponse.json(
      { error: "Impossible de créer cet indice personnalisé." },
      { status: 500 }
    );
  }
}
