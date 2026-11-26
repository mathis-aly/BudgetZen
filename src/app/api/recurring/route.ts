import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.recurringPayment.findMany({
      orderBy: [{ dayOfMonth: 'asc' }, { title: 'asc' }],
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error('GET /api/recurring error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les échéances fixes.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const amount = Number(body.amount);
    const dayOfMonth = Math.min(31, Math.max(1, Math.round(Number(body.dayOfMonth) || 1)));
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!title) {
      return NextResponse.json({ error: 'Le titre de la charge fixe est requis.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Le montant doit être supérieur à 0.' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: 'La catégorie est requise.' }, { status: 400 });
    }

    const created = await prisma.recurringPayment.create({
      data: {
        title,
        amount: Math.round(amount * 100) / 100,
        dayOfMonth,
        categoryId,
        note,
        isActive: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/recurring error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer la charge fixe.' },
      { status: 500 }
    );
  }
}
