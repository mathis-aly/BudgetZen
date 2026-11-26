import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await context.params;
    await prisma.priceEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ deleted: true, id: entryId });
  } catch (error) {
    console.error('DELETE /api/price-tracker/entries/[entryId] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer ce relevé.' },
      { status: 500 }
    );
  }
}
