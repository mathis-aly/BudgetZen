import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = new Set(['INCOME', 'CAPITAL', 'LOCAL', 'OTHER']);

export async function GET() {
  try {
    const entries = await prisma.taxEntry.findMany({
      orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error('GET /api/taxes/entries error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les postes fiscaux.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = Math.round(Number(body.year) || new Date().getFullYear());
    const category = VALID_CATEGORIES.has(body.category) ? body.category : 'INCOME';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const taxableBase = Math.max(0, Number(body.taxableBase) || 0);
    const computedTax = Math.max(0, Number(body.computedTax) || 0);
    const notes =
      typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

    if (!label) {
      return NextResponse.json(
        { error: 'Le libellé est requis.' },
        { status: 400 }
      );
    }

    const created = await prisma.taxEntry.create({
      data: {
        year,
        category,
        label,
        taxableBase: Math.round(taxableBase * 100) / 100,
        computedTax: Math.round(computedTax * 100) / 100,
        notes,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/taxes/entries error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer ce poste fiscal.' },
      { status: 500 }
    );
  }
}
