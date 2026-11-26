import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const data: {
      fiscalParts?: number;
      deductionMode?: string;
      actualFeesAmount?: number;
      withheldTaxPaid?: number;
    } = {};

    if (body.fiscalParts !== undefined) {
      const parts = Number(body.fiscalParts);
      if (!Number.isFinite(parts) || parts < 1 || parts > 12) {
        return NextResponse.json(
          { error: 'Le nombre de parts fiscales doit être compris entre 1 et 12.' },
          { status: 400 }
        );
      }
      data.fiscalParts = Math.round(parts * 4) / 4;
    }

    if (body.deductionMode === 'STANDARD_10' || body.deductionMode === 'ACTUAL_FEES') {
      data.deductionMode = body.deductionMode;
    }

    if (body.actualFeesAmount !== undefined) {
      const fees = Number(body.actualFeesAmount);
      if (Number.isFinite(fees) && fees >= 0) {
        data.actualFeesAmount = Math.round(fees * 100) / 100;
      }
    }

    if (body.withheldTaxPaid !== undefined) {
      const withheld = Number(body.withheldTaxPaid);
      if (Number.isFinite(withheld) && withheld >= 0) {
        data.withheldTaxPaid = Math.round(withheld * 100) / 100;
      }
    }

    const updated = await prisma.taxProfile.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        fiscalParts: data.fiscalParts ?? 1.0,
        deductionMode: data.deductionMode ?? 'STANDARD_10',
        actualFeesAmount: data.actualFeesAmount ?? 0,
        withheldTaxPaid: data.withheldTaxPaid ?? 0,
      },
    });

    return NextResponse.json({
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('PATCH /api/taxes/profile error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour le profil fiscal.' },
      { status: 500 }
    );
  }
}
