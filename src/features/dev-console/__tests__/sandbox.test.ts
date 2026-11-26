import { describe, expect, it } from 'vitest';
import type { AppBootstrapData } from '../../../lib/data';
import {
  applySandboxApiMutation,
  applySandboxCloseMonth,
  applySandboxImportTransactions,
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
});
