import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.reserveExpense.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(
      items.map((i) => ({ ...i, date: i.date.toISOString() }))
    );
  } catch (error) {
    console.error('GET /api/reserve-expenses error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les dépenses exceptionnelles.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    const date = body.date ? new Date(body.date) : new Date();
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Le montant doit être supérieur à 0 €.' },
        { status: 400 }
      );
    }
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
    }

    const created = await prisma.reserveExpense.create({
      data: {
        amount: Math.round(amount * 100) / 100,
        date,
        note,
      },
    });

    return NextResponse.json(
      { ...created, date: created.date.toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/reserve-expenses error:', error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer cette dépense exceptionnelle." },
      { status: 500 }
    );
  }
}
