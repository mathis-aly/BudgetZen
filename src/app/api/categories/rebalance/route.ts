import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromCategoryId, toCategoryId } = body;
    const amount = Math.round(Number(body.amount) * 100) / 100;

    if (!fromCategoryId || !toCategoryId || fromCategoryId === toCategoryId) {
      return NextResponse.json({ error: 'Catégories invalides.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
    }

    const [fromCat, toCat] = await Promise.all([
      prisma.category.findUnique({ where: { id: fromCategoryId } }),
      prisma.category.findUnique({ where: { id: toCategoryId } }),
    ]);

    if (!fromCat || !toCat) {
      return NextResponse.json({ error: 'Catégorie introuvable.' }, { status: 404 });
    }

    const nextFromLimit = Math.max(0, Math.round((fromCat.monthlyLimit - amount) * 100) / 100);
    const nextToLimit = Math.round((toCat.monthlyLimit + amount) * 100) / 100;

    const [updatedFrom, updatedTo] = await prisma.$transaction([
      prisma.category.update({
        where: { id: fromCategoryId },
        data: { monthlyLimit: nextFromLimit },
      }),
      prisma.category.update({
        where: { id: toCategoryId },
        data: { monthlyLimit: nextToLimit },
      }),
    ]);

    return NextResponse.json({ updatedFrom, updatedTo });
  } catch (error) {
    console.error('POST /api/categories/rebalance error:', error);
    return NextResponse.json(
      { error: 'Impossible de rééquilibrer ces budgets.' },
      { status: 500 }
    );
  }
}
