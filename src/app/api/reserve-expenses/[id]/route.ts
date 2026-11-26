import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.reserveExpense.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/reserve-expenses/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer cette dépense exceptionnelle.' },
      { status: 500 }
    );
  }
}
