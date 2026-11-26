import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = new Set(['REAL_ESTATE', 'VEHICLE', 'OTHER']);

export async function GET() {
  try {
    const projects = await prisma.financialProject.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(
      projects.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les projets financiers.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = VALID_CATEGORIES.has(body.category)
      ? body.category
      : 'OTHER';
    const currentPrice = Number(body.currentPrice);
    const extraFeesPercent = Math.min(
      50,
      Math.max(0, Number(body.extraFeesPercent) || 0)
    );
    const annualPriceGrowthPercent = Math.min(
      30,
      Math.max(-50, Number(body.annualPriceGrowthPercent) || 0)
    );
    const targetMonths = Math.min(
      480,
      Math.max(1, Math.round(Number(body.targetMonths) || 24))
    );
    const savedAmount = Math.max(0, Number(body.savedAmount) || 0);
    const useLoan = Boolean(body.useLoan);
    const downPaymentPercent = Math.min(
      100,
      Math.max(0, Number(body.downPaymentPercent ?? (useLoan ? 20 : 100)))
    );
    const loanInterestRate = Math.min(
      25,
      Math.max(0, Number(body.loanInterestRate ?? 3.5))
    );
    const loanDurationYears = Math.min(
      35,
      Math.max(1, Math.round(Number(body.loanDurationYears ?? 20)))
    );

    if (!name) {
      return NextResponse.json(
        { error: 'Le nom du projet est requis.' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return NextResponse.json(
        { error: 'Le prix actuel du bien doit être supérieur à 0 €.' },
        { status: 400 }
      );
    }

    const created = await prisma.financialProject.create({
      data: {
        name,
        category,
        currentPrice: Math.round(currentPrice * 100) / 100,
        extraFeesPercent: Math.round(extraFeesPercent * 10) / 10,
        annualPriceGrowthPercent: Math.round(annualPriceGrowthPercent * 10) / 10,
        targetMonths,
        savedAmount: Math.round(savedAmount * 100) / 100,
        useLoan,
        downPaymentPercent: Math.round(downPaymentPercent * 10) / 10,
        loanInterestRate: Math.round(loanInterestRate * 100) / 100,
        loanDurationYears,
      },
    });

    return NextResponse.json(
      {
        ...created,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json(
      { error: 'Impossible de créer ce projet financier.' },
      { status: 500 }
    );
  }
}
