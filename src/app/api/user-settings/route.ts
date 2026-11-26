import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.userSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        mandatoryReserveRate: 10.0,
        manualInflationRate: 2.5,
      },
    });
    return NextResponse.json({
      ...settings,
      updatedAt: settings.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('GET /api/user-settings error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les paramètres utilisateur.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const data: {
      mandatoryReserveRate?: number;
      manualInflationRate?: number;
    } = {};

    if (body.mandatoryReserveRate !== undefined) {
      const rate = Number(body.mandatoryReserveRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 80) {
        return NextResponse.json(
          { error: 'Le taux de réserve doit être compris entre 0 % et 80 %.' },
          { status: 400 }
        );
      }
      data.mandatoryReserveRate = Math.round(rate * 10) / 10;
    }

    if (body.manualInflationRate !== undefined) {
      const rate = Number(body.manualInflationRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
        return NextResponse.json(
          { error: "Le taux d'inflation doit être compris entre 0 % et 30 %." },
          { status: 400 }
        );
      }
      data.manualInflationRate = Math.round(rate * 10) / 10;
    }

    const updated = await prisma.userSettings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        mandatoryReserveRate: data.mandatoryReserveRate ?? 10.0,
        manualInflationRate: data.manualInflationRate ?? 2.5,
      },
    });

    return NextResponse.json({
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('PATCH /api/user-settings error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour vos paramètres.' },
      { status: 500 }
    );
  }
}
