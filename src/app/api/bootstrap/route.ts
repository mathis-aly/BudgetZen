import { NextResponse } from 'next/server';
import { getBootstrapData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getBootstrapData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/bootstrap error:', error);
    return NextResponse.json(
      { error: 'Impossible de charger les données du budget.' },
      { status: 500 }
    );
  }
}
