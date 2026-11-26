import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = new Set(['REAL_ESTATE', 'VEHICLE', 'OTHER']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const existing = await prisma.financialProject.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Projet financier introuvable.' },
        { status: 404 }
      );
    }

    const data: {
      name?: string;
      category?: string;
      currentPrice?: number;
      extraFeesPercent?: number;
      annualPriceGrowthPercent?: number;
      targetMonths?: number;
      savedAmount?: number;
      useLoan?: boolean;
      downPaymentPercent?: number;
      loanInterestRate?: number;
      loanDurationYears?: number;
    } = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.category === 'string' && VALID_CATEGORIES.has(body.category)) {
      data.category = body.category;
    }
    if (body.currentPrice !== undefined) {
      const cp = Number(body.currentPrice);
      if (Number.isFinite(cp) && cp > 0) {
        data.currentPrice = Math.round(cp * 100) / 100;
      }
    }
    if (body.extraFeesPercent !== undefined) {
      const ef = Number(body.extraFeesPercent);
      if (Number.isFinite(ef)) {
        data.extraFeesPercent = Math.round(Math.min(50, Math.max(0, ef)) * 10) / 10;
      }
    }
    if (body.annualPriceGrowthPercent !== undefined) {
      const g = Number(body.annualPriceGrowthPercent);
      if (Number.isFinite(g)) {
        data.annualPriceGrowthPercent =
          Math.round(Math.min(30, Math.max(-50, g)) * 10) / 10;
      }
    }
    if (body.targetMonths !== undefined) {
      const tm = Math.round(Number(body.targetMonths));
      if (Number.isFinite(tm) && tm >= 1) {
        data.targetMonths = Math.min(480, Math.max(1, tm));
      }
    }
    if (body.addSavings !== undefined) {
      const delta = Number(body.addSavings);
      if (Number.isFinite(delta)) {
        data.savedAmount = Math.max(
          0,
          Math.round((existing.savedAmount + delta) * 100) / 100
        );
      }
    } else if (body.savedAmount !== undefined) {
      const sa = Number(body.savedAmount);
      if (Number.isFinite(sa) && sa >= 0) {
        data.savedAmount = Math.round(sa * 100) / 100;
      }
    }
    if (typeof body.useLoan === 'boolean') {
      data.useLoan = body.useLoan;
    }
    if (body.downPaymentPercent !== undefined) {
      const dp = Number(body.downPaymentPercent);
      if (Number.isFinite(dp)) {
        data.downPaymentPercent =
          Math.round(Math.min(100, Math.max(0, dp)) * 10) / 10;
      }
    }
    if (body.loanInterestRate !== undefined) {
      const lr = Number(body.loanInterestRate);
      if (Number.isFinite(lr)) {
        data.loanInterestRate =
          Math.round(Math.min(25, Math.max(0, lr)) * 100) / 100;
      }
    }
    if (body.loanDurationYears !== undefined) {
      const dy = Math.round(Number(body.loanDurationYears));
      if (Number.isFinite(dy) && dy >= 1) {
        data.loanDurationYears = Math.min(35, Math.max(1, dy));
      }
    }

    const updated = await prisma.financialProject.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de mettre à jour ce projet financier.' },
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
    await prisma.financialProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer ce projet financier.' },
      { status: 500 }
    );
  }
}
