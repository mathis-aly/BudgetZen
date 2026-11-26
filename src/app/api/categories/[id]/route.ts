import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const data: {
      name?: string;
      color?: string;
      icon?: string;
      monthlyLimit?: number;
      alertThreshold?: number;
      isArchived?: boolean;
      sortOrder?: number;
    } = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.color === 'string' && body.color) {
      data.color = body.color;
    }
    if (typeof body.icon === 'string' && body.icon) {
      data.icon = body.icon;
    }
    if (body.monthlyLimit !== undefined) {
      const limit = Number(body.monthlyLimit);
      if (Number.isFinite(limit) && limit >= 0) {
        data.monthlyLimit = Math.round(limit * 100) / 100;
      }
    }
    if (body.alertThreshold !== undefined) {
      const threshold = Math.round(Number(body.alertThreshold));
      if (Number.isFinite(threshold)) {
        data.alertThreshold = Math.min(100, Math.max(10, threshold));
      }
    }
    if (typeof body.isArchived === 'boolean') {
      data.isArchived = body.isArchived;
    }
    if (typeof body.sortOrder === 'number') {
      data.sortOrder = body.sortOrder;
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/categories/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour la catégorie.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const txCount = await prisma.transaction.count({ where: { categoryId: id } });
    const recCount = await prisma.recurringPayment.count({ where: { categoryId: id } });

    if (txCount > 0 || recCount > 0) {
      const archived = await prisma.category.update({
        where: { id },
        data: { isArchived: true },
      });
      return NextResponse.json({ archived: true, category: archived });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/categories/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer la catégorie.' },
      { status: 500 }
    );
  }
}
