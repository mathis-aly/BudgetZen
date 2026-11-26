import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les catégories.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = body.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const color = typeof body.color === 'string' && body.color ? body.color : '#007AFF';
    const icon = typeof body.icon === 'string' && body.icon ? body.icon : 'Tag';
    const monthlyLimit = Math.max(0, Number(body.monthlyLimit) || 0);
    const alertThreshold = Math.min(100, Math.max(10, Math.round(Number(body.alertThreshold) || 80)));

    if (!name) {
      return NextResponse.json({ error: 'Le nom de la catégorie est requis.' }, { status: 400 });
    }

    const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.category.create({
      data: {
        name,
        type,
        color,
        icon,
        monthlyLimit: type === 'EXPENSE' ? Math.round(monthlyLimit * 100) / 100 : 0,
        alertThreshold,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/categories error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer la catégorie.' },
      { status: 500 }
    );
  }
}
