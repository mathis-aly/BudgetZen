import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(
      transactions.map((t) => ({
        ...t,
        date: t.date.toISOString(),
      }))
    );
  } catch (error) {
    console.error('GET /api/transactions error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la lecture des transactions.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    const type = body.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const date = body.date ? new Date(body.date) : new Date();
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Le montant doit être supérieur à 0.' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: 'Veuillez sélectionner une catégorie.' }, { status: 400 });
    }
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
    }

    const created = await prisma.transaction.create({
      data: {
        amount: Math.round(amount * 100) / 100,
        type,
        categoryId,
        date,
        note,
      },
    });

    return NextResponse.json(
      {
        ...created,
        date: created.date.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/transactions error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer la transaction.' },
      { status: 500 }
    );
  }
}
