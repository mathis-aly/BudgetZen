import { describe, expect, it } from 'vitest';
import type { AppBootstrapData } from '../../../lib/data';
import {
  applySandboxApiMutation,
  applySandboxCloseMonth,
  applySandboxImportTransactions,
  resetSandboxToZero,
} from '../sandbox-reducer';

function createFixtureState(): AppBootstrapData {
  return {
    settings: {
      id: 'default',
      accountName: 'Compte Principal',
      initialBalance: 2500,
      currency: 'EUR',
      monthlyIncomeTarget: 3200,
    },
    userSettings: {
      id: 1,
      mandatoryReserveRate: 10,
      manualInflationRate: 2.5,
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    categories: [
      {
        id: 'cat_salary',
        name: 'Salaire',
        type: 'INCOME',
        color: '#15803D',
        icon: 'Wallet',
        monthlyLimit: 0,
        alertThreshold: 80,
        isArchived: false,
        sortOrder: 1,
      },
      {
        id: 'cat_food',
        name: 'Alimentation',
        type: 'EXPENSE',
        color: '#B45309',
        icon: 'ShoppingBag',
        monthlyLimit: 500,
        alertThreshold: 80,
        isArchived: false,
        sortOrder: 2,
      },
    ],
    transactions: [
      {
        id: 'tx_1',
        amount: 3200,
        type: 'INCOME',
        date: '2026-11-02T09:00:00.000Z',
        note: 'Salaire novembre',
        categoryId: 'cat_salary',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ],
    recurringPayments: [],
    wealthAssets: [
      {
        id: 'asset_pea',
        name: 'PEA ETF Monde',
        category: 'STOCKS',
        currentValue: 12000,
        monthlyContribution: 400,
        expectedAnnualYield: 7,
        lastUpdated: '2026-11-01T10:00:00.000Z',
        snapshots: [
          {
            id: 'snap_1',
            assetId: 'asset_pea',
            value: 12000,
            recordedAt: '2026-11-01T10:00:00.000Z',
          },
        ],
      },
    ],
    reserveExpenses: [],
    trackedProducts: [
      {
        id: 'prod_coffee',
        name: 'Café Grain 1kg',
        unit: 'kg',
        targetAlertPercent: 5,
        createdAt: '2026-10-01T10:00:00.000Z',
        entries: [
          {
            id: 'pe_1',
            productId: 'prod_coffee',
            price: 16.5,
            store: 'BioCoop',
            recordedAt: '2026-10-15T10:00:00.000Z',
          },
        ],
      },
    ],
    monthlyReports: [],
    taxProfile: {
      id: 1,
      fiscalParts: 1,
      deductionMode: 'STANDARD_10',
      actualFeesAmount: 0,
      withheldTaxPaid: 0,
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    taxEntries: [],
    customIndices: [],
    financialProjects: [],
  };
}

describe('Sandbox client reducer isolation', () => {
  it('simulates new income transactions and settings changes without mutating original SQLite fixture', () => {
    const prodState = createFixtureState();
    const frozenBefore = JSON.stringify(prodState);

    const txStep = applySandboxApiMutation(prodState, 'POST', '/api/transactions', {
      amount: 950,
      type: 'INCOME',
      categoryId: 'cat_salary',
      note: 'Prime simulée',
      date: '2026-11-26T12:00:00.000Z',
    });

    expect(txStep.response.status).toBe(201);
    expect(txStep.state.transactions).toHaveLength(2);
    expect(txStep.state.transactions[0]?.amount).toBe(950);

    const settingsStep = applySandboxApiMutation(
      txStep.state,
      'PATCH',
      '/api/user-settings',
      {
        mandatoryReserveRate: 18,
        manualInflationRate: 3.2,
      }
    );

    expect(settingsStep.response.status).toBe(200);
    expect(settingsStep.state.userSettings.mandatoryReserveRate).toBe(18);
    expect(settingsStep.state.userSettings.manualInflationRate).toBe(3.2);

    // Original production snapshot must remain untouched
    expect(JSON.stringify(prodState)).toBe(frozenBefore);
    expect(prodState.transactions).toHaveLength(1);
    expect(prodState.userSettings.mandatoryReserveRate).toBe(10);
  });

  it('updates wealth contribution and balance in memory without mutating initial assets', () => {
    const prodState = createFixtureState();

    const step1 = applySandboxApiMutation(
      prodState,
      'PATCH',
      '/api/wealth/asset_pea',
      {
        monthlyContribution: 850,
        expectedAnnualYield: 8.5,
      }
    );
    expect(step1.response.status).toBe(200);
    expect(step1.state.wealthAssets[0]?.monthlyContribution).toBe(850);

    const step2 = applySandboxApiMutation(
      step1.state,
      'POST',
      '/api/wealth/asset_pea/snapshot',
      { value: 15400 }
    );
    expect(step2.response.status).toBe(201);
    expect(step2.state.wealthAssets[0]?.currentValue).toBe(15400);
    expect(step2.state.wealthAssets[0]?.snapshots).toHaveLength(2);

    expect(prodState.wealthAssets[0]?.currentValue).toBe(12000);
    expect(prodState.wealthAssets[0]?.monthlyContribution).toBe(400);
    expect(prodState.wealthAssets[0]?.snapshots).toHaveLength(1);
  });

  it('recalculates initialBalance cleanly when simulating currentBalance via /api/settings', () => {
    const prodState = createFixtureState();
    const res = applySandboxApiMutation(prodState, 'PATCH', '/api/settings', {
      currentBalance: 10000,
    });

    expect(res.response.status).toBe(200);
    // Net flow in fixture is +3200, so initialBalance must be 10000 - 3200 = 6800
    expect(res.state.settings.initialBalance).toBe(6800);
    expect(prodState.settings.initialBalance).toBe(2500);
  });

  it('runs CSV import and monthly close exclusively in memory', () => {
    const prodState = createFixtureState();

    const imported = applySandboxImportTransactions(prodState, [
      {
        dateIso: '2026-11-18T10:00:00.000Z',
        type: 'EXPENSE',
        categoryName: 'Transports',
        amount: 64.5,
        note: 'Navigo',
      },
    ]);

    expect(imported.result.ok).toBe(true);
    expect(imported.result.importedCount).toBe(1);
    expect(imported.result.createdCategoriesCount).toBe(1);
    expect(imported.state.transactions).toHaveLength(2);

    const closed = applySandboxCloseMonth(imported.state, {
      month: '2026-11',
      totalIncome: 3200,
      totalExpenses: 64.5,
      reserveAmount: 320,
      netWorthEnd: 15200,
      personalInflation: 2.8,
      notes: 'Clôture simulée',
      assetUpdates: [{ assetId: 'asset_pea', newValue: 12500 }],
      priceEntries: [{ productId: 'prod_coffee', price: 17.2, store: 'BioCoop' }],
    });

    expect(closed.result.ok).toBe(true);
    expect(closed.result.updatedAssetsCount).toBe(1);
    expect(closed.result.createdPricesCount).toBe(1);
    expect(closed.state.monthlyReports).toHaveLength(1);
    expect(closed.state.wealthAssets[0]?.currentValue).toBe(12500);

    // Production state remains zero-impacted
    expect(prodState.monthlyReports).toHaveLength(0);
    expect(prodState.categories).toHaveLength(2);
    expect(prodState.trackedProducts[0]?.entries).toHaveLength(1);
  });

  it('resets sandbox memory completely to 0 € while keeping categories usable and prod untouched', () => {
    const prodState = createFixtureState();
    const frozenBefore = JSON.stringify(prodState);

    const zeroed = resetSandboxToZero(prodState);

    expect(zeroed.settings.initialBalance).toBe(0);
    expect(zeroed.settings.monthlyIncomeTarget).toBe(0);
    expect(zeroed.transactions).toHaveLength(0);
    expect(zeroed.wealthAssets).toHaveLength(0);
    expect(zeroed.trackedProducts).toHaveLength(0);
    expect(zeroed.monthlyReports).toHaveLength(0);
    expect(zeroed.planningNodes).toHaveLength(0);
    expect(zeroed.planningEdges).toHaveLength(0);
    expect(zeroed.categories).toHaveLength(2);
    expect(zeroed.categories.every((c) => c.monthlyLimit === 0)).toBe(true);

    expect(JSON.stringify(prodState)).toBe(frozenBefore);
  });

  it('handles planning nodes and edges strictly in memory when Sandbox is active', () => {
    const prodState = createFixtureState();

    const n1 = applySandboxApiMutation(
      prodState,
      'POST',
      '/api/planning/nodes',
      {
        type: 'IDEA',
        title: 'Livret boosté',
        content: 'Objectif 6 mois',
        positionX: 120,
        positionY: 80,
      }
    );
    expect(n1.response.status).toBe(201);
    const node1 = n1.response.data as { id: string };

    const n2 = applySandboxApiMutation(
      n1.state,
      'POST',
      '/api/planning/nodes',
      {
        type: 'RESOURCE',
        title: 'Vidéo PEA',
        url: 'https://youtu.be/dQw4w9WgXcQ',
        resourceKind: 'YOUTUBE',
        positionX: 420,
        positionY: 160,
      }
    );
    expect(n2.response.status).toBe(201);
    const node2 = n2.response.data as { id: string };

    const edgeRes = applySandboxApiMutation(
      n2.state,
      'POST',
      '/api/planning/edges',
      {
        sourceId: node1.id,
        targetId: node2.id,
        label: 'inspiration',
      }
    );
    expect(edgeRes.response.status).toBe(201);
    expect(edgeRes.state.planningNodes).toHaveLength(2);
    expect(edgeRes.state.planningEdges).toHaveLength(1);

    const fetched = applySandboxApiMutation(edgeRes.state, 'GET', '/api/planning');
    expect(fetched.response.status).toBe(200);
    expect(
      (fetched.response.data as { nodes: unknown[]; edges: unknown[] }).nodes
    ).toHaveLength(2);

    const moved = applySandboxApiMutation(
      edgeRes.state,
      'PATCH',
      `/api/planning/nodes/${node1.id}`,
      { positionX: 300, positionY: 220 }
    );
    expect(moved.response.status).toBe(200);
    expect(moved.state.planningNodes?.[0]?.positionX).toBe(300);

    const del = applySandboxApiMutation(
      moved.state,
      'DELETE',
      `/api/planning/nodes/${node1.id}`
    );
    expect(del.response.status).toBe(200);
    expect(del.state.planningNodes).toHaveLength(1);
    expect(del.state.planningEdges).toHaveLength(0);
    expect(prodState.planningNodes).toBeUndefined();
  });

  it('simulates financial projects creation, addSavings, delete, and reset to 0 in memory', () => {
    const prodState = createFixtureState();

    const createdRes = applySandboxApiMutation(
      prodState,
      'POST',
      '/api/projects',
      {
        name: 'Appartement T2 Toulouse',
        category: 'REAL_ESTATE',
        currentPrice: 220000,
        extraFeesPercent: 8,
        annualPriceGrowthPercent: 2,
        targetMonths: 24,
        savedAmount: 15000,
        useLoan: true,
        downPaymentPercent: 20,
        loanInterestRate: 3.5,
        loanDurationYears: 20,
      }
    );

    expect(createdRes.response.status).toBe(201);
    const createdProj = createdRes.response.data as { id: string; savedAmount: number };
    expect(createdProj.savedAmount).toBe(15000);
    expect(createdRes.state.financialProjects).toHaveLength(1);

    const addedRes = applySandboxApiMutation(
      createdRes.state,
      'PATCH',
      `/api/projects/${createdProj.id}`,
      { addSavings: 2500 }
    );
    expect(addedRes.response.status).toBe(200);
    expect(addedRes.state.financialProjects[0]?.savedAmount).toBe(17500);

    const zeroed = resetSandboxToZero(addedRes.state);
    expect(zeroed.financialProjects).toHaveLength(0);

    const deletedRes = applySandboxApiMutation(
      addedRes.state,
      'DELETE',
      `/api/projects/${createdProj.id}`
    );
    expect(deletedRes.response.status).toBe(200);
    expect(deletedRes.state.financialProjects).toHaveLength(0);
    expect(prodState.financialProjects).toHaveLength(0);
  });
});
