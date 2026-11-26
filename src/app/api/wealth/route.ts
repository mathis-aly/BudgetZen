import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_CATEGORIES = new Set(['SAVINGS', 'STOCKS', 'REAL_ESTATE', 'OTHER']);

export async function GET() {
  try {
    const assets = await prisma.wealthAsset.findMany({
      orderBy: [{ currentValue: 'desc' }, { name: 'asc' }],
      include: { snapshots: { orderBy: { recordedAt: 'asc' } } },
    });
    return NextResponse.json(assets);
  } catch (error) {
    console.error('GET /api/wealth error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les actifs patrimoniaux.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = ALLOWED_CATEGORIES.has(body.category) ? body.category : 'SAVINGS';
    const currentValue = Math.max(0, Number(body.currentValue) || 0);
    const monthlyContribution = Math.max(0, Number(body.monthlyContribution) || 0);
    const expectedAnnualYield = Math.min(
      50,
      Math.max(-20, Number(body.expectedAnnualYield) || 0)
    );

    if (!name) {
      return NextResponse.json(
        { error: 'Le nom du support est requis.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const created = await prisma.wealthAsset.create({
      data: {
        name,
        category,
        currentValue: Math.round(currentValue * 100) / 100,
        monthlyContribution: Math.round(monthlyContribution * 100) / 100,
        expectedAnnualYield: Math.round(expectedAnnualYield * 100) / 100,
        lastUpdated: now,
        snapshots: {
          create: {
            value: Math.round(currentValue * 100) / 100,
            recordedAt: now,
          },
        },
      },
      include: { snapshots: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/wealth error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer ce support.' },
      { status: 500 }
    );
  }
}
