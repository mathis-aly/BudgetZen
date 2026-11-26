import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.trackedProduct.findMany({
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      include: { entries: { orderBy: { recordedAt: 'asc' } } },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('GET /api/price-tracker error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les produits suivis.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const unit =
      typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : 'unité';
    const targetAlertPercent = Math.min(
      100,
      Math.max(0.5, Number(body.targetAlertPercent) || 5.0)
    );
    const initialPrice =
      body.initialPrice !== undefined && body.initialPrice !== null && body.initialPrice !== ''
        ? Number(body.initialPrice)
        : null;
    const initialStore =
      typeof body.initialStore === 'string' && body.initialStore.trim()
        ? body.initialStore.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: 'Le nom du produit est requis.' },
        { status: 400 }
      );
    }

    if (initialPrice !== null && (!Number.isFinite(initialPrice) || initialPrice <= 0)) {
      return NextResponse.json(
        { error: 'Le prix initial doit être supérieur à 0 €.' },
        { status: 400 }
      );
    }

    const created = await prisma.trackedProduct.create({
      data: {
        name,
        unit,
        targetAlertPercent: Math.round(targetAlertPercent * 10) / 10,
        ...(initialPrice !== null
          ? {
              entries: {
                create: {
                  price: Math.round(initialPrice * 100) / 100,
                  store: initialStore,
                  recordedAt: new Date(),
                },
              },
            }
          : {}),
      },
      include: { entries: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/price-tracker error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer ce produit suivi.' },
      { status: 500 }
    );
  }
}
