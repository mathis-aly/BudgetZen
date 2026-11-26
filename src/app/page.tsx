import React from 'react';
import { getBootstrapData } from '@/lib/data';
import { BudgetAppShell } from '@/components/BudgetAppShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialData = await getBootstrapData();
  return <BudgetAppShell initialData={initialData} />;
}
