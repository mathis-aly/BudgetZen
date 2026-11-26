import type { AppBootstrapData } from '@/lib/data';
import type {
  CloseMonthActionInput,
  CloseMonthActionResult,
} from '@/features/monthly-close/actions';
import type {
  ImportTransactionRowPayload,
  ImportTransactionsActionResult,
} from '@/features/transactions/actions';
import {
  CategoryDTO,
  CustomIndexDTO,
  CustomIndexType,
  FinancialProjectCategory,
  FinancialProjectDTO,
  IndexComponentSourceType,
  MonthlyReportDTO,
  PlanningEdgeDTO,
  PlanningNodeDTO,
  PlanningNodeType,
  PlanningResourceKind,
  RecurringPaymentDTO,
  ReserveExpenseDTO,
  TaxEntryCategory,
  TaxEntryDTO,
  TrackedProductDTO,
  TransactionDTO,
  WealthAssetCategory,
  WealthAssetDTO,
  getMonthKey,
  roundCurrency,
} from '../../core';

let sandboxSeq = 0;

function createSandboxId(prefix: string): string {
  sandboxSeq += 1;
  return `sbx_${prefix}_${Date.now()}_${sandboxSeq}`;
}

export interface SandboxApiResponse {
  status: number;
  data: unknown;
}

const VALID_WEALTH_CATEGORIES = new Set<WealthAssetCategory>([
  'SAVINGS',
  'STOCKS',
  'REAL_ESTATE',
  'OTHER',
]);

const VALID_TAX_CATEGORIES = new Set<TaxEntryCategory>([
  'INCOME',
  'CAPITAL',
  'LOCAL',
  'OTHER',
]);

const VALID_SOURCE_TYPES = new Set<IndexComponentSourceType>([
  'TRACKED_PRODUCT',
  'EXPENSE_CATEGORY',
  'WEALTH_ASSET',
  'MANUAL_SERIES',
]);

const AUTO_CATEGORY_COLORS = [
  '#15803D',
  '#B45309',
  '#1D4ED8',
  '#7C3AED',
  '#0F766E',
  '#B91C1C',
  '#475569',
];

function normalizeCategoryKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function asObject(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function ok(state: AppBootstrapData, data: unknown, status = 200) {
  return { state, response: { status, data } satisfies SandboxApiResponse };
}

function fail(state: AppBootstrapData, message: string, status = 400) {
  return { state, response: { status, data: { error: message } } satisfies SandboxApiResponse };
}

const VALID_PLANNING_TYPES = new Set<PlanningNodeType>([
  'IDEA',
  'RESOURCE',
  'GOAL',
]);

const VALID_RESOURCE_KINDS = new Set<PlanningResourceKind>([
  'YOUTUBE',
  'ARTICLE',
]);

const VALID_PROJECT_CATEGORIES = new Set<FinancialProjectCategory>([
  'REAL_ESTATE',
  'VEHICLE',
  'OTHER',
]);

/**
 * Empties all balances, targets, transactions, assets, prices, taxes, and planning
 * graphs in memory so users can test a clean 0 € scenario inside Sandbox Mode.
 */
export function resetSandboxToZero(
  currentState: AppBootstrapData
): AppBootstrapData {
  const next = structuredClone(currentState);
  const nowIso = new Date().toISOString();

  next.settings = {
    ...next.settings,
    initialBalance: 0,
    monthlyIncomeTarget: 0,
  };

  next.categories = next.categories.map((cat) => ({
    ...cat,
    monthlyLimit: 0,
    isArchived: false,
  }));

  next.transactions = [];
  next.recurringPayments = [];
  next.reserveExpenses = [];
  next.wealthAssets = [];
  next.trackedProducts = [];
  next.monthlyReports = [];
  next.taxProfile = {
    ...next.taxProfile,
    fiscalParts: 1,
    deductionMode: 'STANDARD_10',
    actualFeesAmount: 0,
    withheldTaxPaid: 0,
    updatedAt: nowIso,
  };
  next.taxEntries = [];
  next.customIndices = [];
  next.financialProjects = [];
  next.planningNodes = [];
  next.planningEdges = [];

  return next;
}

/**
 * Pure client-only state reducer simulating every `/api/*` endpoint against an
 * in-memory clone of `AppBootstrapData`. Never triggers any network or Prisma write.
 */
export function applySandboxApiMutation(
  currentState: AppBootstrapData,
  methodInput: string,
  pathnameInput: string,
  rawBody?: unknown
): { state: AppBootstrapData; response: SandboxApiResponse } {
  const method = methodInput.toUpperCase();
  const pathname = pathnameInput.replace(/\/+$/, '');
  const body = asObject(rawBody);
  const state = structuredClone(currentState);
  const nowIso = new Date().toISOString();

  // --- Bootstrap / Read-only collections ---
  if (method === 'GET') {
    switch (pathname) {
      case '/api/bootstrap':
        return ok(state, state);
      case '/api/user-settings':
        return ok(state, state.userSettings);
      case '/api/transactions':
        return ok(state, state.transactions);
      case '/api/categories':
        return ok(state, state.categories);
      case '/api/recurring':
        return ok(state, state.recurringPayments);
      case '/api/reserve-expenses':
        return ok(state, state.reserveExpenses);
      case '/api/wealth':
        return ok(state, state.wealthAssets);
      case '/api/price-tracker':
        return ok(state, state.trackedProducts);
      case '/api/taxes/entries':
        return ok(state, state.taxEntries);
      case '/api/custom-indices':
        return ok(state, state.customIndices);
      case '/api/projects':
        return ok(state, state.financialProjects);
      case '/api/planning':
        return ok(state, {
          nodes: state.planningNodes ?? [],
          edges: state.planningEdges ?? [],
        });
      default:
        return fail(state, 'Route Sandbox non implémentée (lecture).', 404);
    }
  }

  // --- Account settings (/api/settings) ---
  if (pathname === '/api/settings' && method === 'PATCH') {
    if (typeof body.accountName === 'string' && body.accountName.trim()) {
      state.settings.accountName = body.accountName.trim();
    }
    if (
      typeof body.monthlyIncomeTarget === 'number' &&
      Number.isFinite(body.monthlyIncomeTarget)
    ) {
      state.settings.monthlyIncomeTarget = Math.max(
        0,
        roundCurrency(body.monthlyIncomeTarget)
      );
    }
    if (
      typeof body.currentBalance === 'number' &&
      Number.isFinite(body.currentBalance)
    ) {
      const netFlow =
        state.transactions.reduce(
          (acc, tx) => acc + (tx.type === 'INCOME' ? tx.amount : -tx.amount),
          0
        ) - state.reserveExpenses.reduce((acc, exp) => acc + exp.amount, 0);
      state.settings.initialBalance = roundCurrency(body.currentBalance - netFlow);
    } else if (
      typeof body.initialBalance === 'number' &&
      Number.isFinite(body.initialBalance)
    ) {
      state.settings.initialBalance = roundCurrency(body.initialBalance);
    }
    return ok(state, state.settings);
  }

  // --- User settings (/api/user-settings) ---
  if (pathname === '/api/user-settings' && method === 'PATCH') {
    if (body.mandatoryReserveRate !== undefined) {
      const rate = Number(body.mandatoryReserveRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 80) {
        return fail(state, 'Le taux de réserve doit être compris entre 0 % et 80 %.');
      }
      state.userSettings.mandatoryReserveRate = Math.round(rate * 10) / 10;
    }
    if (body.manualInflationRate !== undefined) {
      const rate = Number(body.manualInflationRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
        return fail(state, "Le taux d'inflation doit être compris entre 0 % et 30 %.");
      }
      state.userSettings.manualInflationRate = Math.round(rate * 10) / 10;
    }
    state.userSettings.updatedAt = nowIso;
    return ok(state, state.userSettings);
  }

  // --- Transactions (/api/transactions, /api/transactions/:id) ---
  if (pathname === '/api/transactions' && method === 'POST') {
    const amount = Number(body.amount);
    const type = body.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const date = body.date ? new Date(String(body.date)) : new Date();
    const note =
      typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(state, 'Le montant doit être supérieur à 0.');
    }
    if (!categoryId) {
      return fail(state, 'Veuillez sélectionner une catégorie.');
    }
    if (Number.isNaN(date.getTime())) {
      return fail(state, 'Date invalide.');
    }

    const created: TransactionDTO = {
      id: createSandboxId('tx'),
      amount: roundCurrency(amount),
      type,
      categoryId,
      date: date.toISOString(),
      note,
      recurringPaymentId: null,
      billingMonth: null,
    };
    state.transactions = [created, ...state.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return ok(state, created, 201);
  }

  const txMatch = pathname.match(/^\/api\/transactions\/([^/]+)$/);
  if (txMatch) {
    const id = decodeURIComponent(txMatch[1]);
    const idx = state.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return fail(state, 'Transaction introuvable.', 404);

    if (method === 'PATCH') {
      const target = state.transactions[idx];
      if (body.amount !== undefined) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return fail(state, 'Montant invalide.');
        }
        target.amount = roundCurrency(amount);
      }
      if (body.type === 'EXPENSE' || body.type === 'INCOME') {
        target.type = body.type;
      }
      if (typeof body.categoryId === 'string' && body.categoryId) {
        target.categoryId = body.categoryId;
      }
      if (body.date) {
        const d = new Date(String(body.date));
        if (Number.isNaN(d.getTime())) return fail(state, 'Date invalide.');
        target.date = d.toISOString();
      }
      if (body.note !== undefined) {
        target.note =
          typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
      }
      state.transactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return ok(state, target);
    }

    if (method === 'DELETE') {
      state.transactions.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  // --- Categories (/api/categories, /rebalance, /:id) ---
  if (pathname === '/api/categories/rebalance' && method === 'POST') {
    const fromCategoryId =
      typeof body.fromCategoryId === 'string' ? body.fromCategoryId : '';
    const toCategoryId =
      typeof body.toCategoryId === 'string' ? body.toCategoryId : '';
    const amount = roundCurrency(Number(body.amount));

    if (!fromCategoryId || !toCategoryId || fromCategoryId === toCategoryId) {
      return fail(state, 'Catégories invalides.');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(state, 'Montant invalide.');
    }

    const fromCat = state.categories.find((c) => c.id === fromCategoryId);
    const toCat = state.categories.find((c) => c.id === toCategoryId);
    if (!fromCat || !toCat) {
      return fail(state, 'Catégorie introuvable.', 404);
    }

    fromCat.monthlyLimit = Math.max(0, roundCurrency(fromCat.monthlyLimit - amount));
    toCat.monthlyLimit = roundCurrency(toCat.monthlyLimit + amount);
    return ok(state, { updatedFrom: fromCat, updatedTo: toCat });
  }

  if (pathname === '/api/categories' && method === 'POST') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return fail(state, 'Le nom de la catégorie est requis.');

    const type = body.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const maxSort = state.categories.reduce(
      (max, c) => Math.max(max, c.sortOrder),
      0
    );
    const created: CategoryDTO = {
      id: createSandboxId('cat'),
      name,
      type,
      color: typeof body.color === 'string' && body.color ? body.color : '#007AFF',
      icon: typeof body.icon === 'string' && body.icon ? body.icon : 'Tag',
      monthlyLimit:
        type === 'EXPENSE'
          ? Math.max(0, roundCurrency(Number(body.monthlyLimit) || 0))
          : 0,
      alertThreshold: Math.min(
        100,
        Math.max(10, Math.round(Number(body.alertThreshold) || 80))
      ),
      isArchived: false,
      sortOrder: maxSort + 1,
    };
    state.categories.push(created);
    return ok(state, created, 201);
  }

  const catMatch = pathname.match(/^\/api\/categories\/([^/]+)$/);
  if (catMatch) {
    const id = decodeURIComponent(catMatch[1]);
    const idx = state.categories.findIndex((c) => c.id === id);
    if (idx === -1) return fail(state, 'Catégorie introuvable.', 404);

    if (method === 'PATCH') {
      const cat = state.categories[idx];
      if (typeof body.name === 'string' && body.name.trim()) {
        cat.name = body.name.trim();
      }
      if (typeof body.color === 'string' && body.color) cat.color = body.color;
      if (typeof body.icon === 'string' && body.icon) cat.icon = body.icon;
      if (body.monthlyLimit !== undefined) {
        const limit = Number(body.monthlyLimit);
        if (Number.isFinite(limit) && limit >= 0) {
          cat.monthlyLimit = roundCurrency(limit);
        }
      }
      if (body.alertThreshold !== undefined) {
        const t = Math.round(Number(body.alertThreshold));
        if (Number.isFinite(t)) cat.alertThreshold = Math.min(100, Math.max(10, t));
      }
      if (typeof body.isArchived === 'boolean') cat.isArchived = body.isArchived;
      if (typeof body.sortOrder === 'number') cat.sortOrder = body.sortOrder;
      return ok(state, cat);
    }

    if (method === 'DELETE') {
      state.categories.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  // --- Recurring payments (/api/recurring, /:id, /:id/validate) ---
  if (pathname === '/api/recurring' && method === 'POST') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const amount = Number(body.amount);
    const dayOfMonth = Math.min(
      31,
      Math.max(1, Math.round(Number(body.dayOfMonth) || 1))
    );
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const note =
      typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!title) return fail(state, 'Le titre de la charge fixe est requis.');
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(state, 'Le montant doit être supérieur à 0.');
    }
    if (!categoryId) return fail(state, 'La catégorie est requise.');

    const created: RecurringPaymentDTO = {
      id: createSandboxId('rec'),
      title,
      amount: roundCurrency(amount),
      dayOfMonth,
      categoryId,
      isActive: true,
      note,
      lastPaidMonth: null,
    };
    state.recurringPayments.push(created);
    return ok(state, created, 201);
  }

  const recurringValidateMatch = pathname.match(
    /^\/api\/recurring\/([^/]+)\/validate$/
  );
  if (recurringValidateMatch && method === 'POST') {
    const id = decodeURIComponent(recurringValidateMatch[1]);
    const payment = state.recurringPayments.find((r) => r.id === id);
    if (!payment) return fail(state, 'Échéance introuvable.', 404);

    const billingMonth =
      typeof body.billingMonth === 'string' &&
      /^\d{4}-\d{2}$/.test(body.billingMonth)
        ? body.billingMonth
        : getMonthKey(new Date());

    const duplicate = state.transactions.some(
      (tx) => tx.recurringPaymentId === id && tx.billingMonth === billingMonth
    );
    if (duplicate || payment.lastPaidMonth === billingMonth) {
      return fail(state, 'Cette échéance est déjà validée pour ce mois.', 409);
    }

    payment.lastPaidMonth = billingMonth;
    const createdTx: TransactionDTO = {
      id: createSandboxId('tx'),
      amount: payment.amount,
      type: 'EXPENSE',
      date: nowIso,
      note: payment.note ? `${payment.title} — ${payment.note}` : payment.title,
      categoryId: payment.categoryId,
      recurringPaymentId: payment.id,
      billingMonth,
    };
    state.transactions = [createdTx, ...state.transactions];
    return ok(state, { recurringPayment: payment, transaction: createdTx });
  }

  const recurringMatch = pathname.match(/^\/api\/recurring\/([^/]+)$/);
  if (recurringMatch) {
    const id = decodeURIComponent(recurringMatch[1]);
    const idx = state.recurringPayments.findIndex((r) => r.id === id);
    if (idx === -1) return fail(state, 'Échéance introuvable.', 404);

    if (method === 'PATCH') {
      const item = state.recurringPayments[idx];
      if (typeof body.title === 'string' && body.title.trim()) {
        item.title = body.title.trim();
      }
      if (body.amount !== undefined) {
        const amount = Number(body.amount);
        if (Number.isFinite(amount) && amount > 0) {
          item.amount = roundCurrency(amount);
        }
      }
      if (body.dayOfMonth !== undefined) {
        const d = Number(body.dayOfMonth);
        if (Number.isFinite(d)) {
          item.dayOfMonth = Math.min(31, Math.max(1, Math.round(d)));
        }
      }
      if (typeof body.categoryId === 'string' && body.categoryId) {
        item.categoryId = body.categoryId;
      }
      if (typeof body.isActive === 'boolean') item.isActive = body.isActive;
      if (body.note !== undefined) {
        item.note =
          typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
      }
      if (body.lastPaidMonth !== undefined) {
        item.lastPaidMonth =
          typeof body.lastPaidMonth === 'string' ? body.lastPaidMonth : null;
      }
      return ok(state, item);
    }

    if (method === 'DELETE') {
      state.recurringPayments.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  // --- Reserve expenses (/api/reserve-expenses, /:id) ---
  if (pathname === '/api/reserve-expenses' && method === 'POST') {
    const amount = Number(body.amount);
    const date = body.date ? new Date(String(body.date)) : new Date();
    const note =
      typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(state, 'Le montant doit être supérieur à 0 €.');
    }
    if (Number.isNaN(date.getTime())) return fail(state, 'Date invalide.');

    const created: ReserveExpenseDTO = {
      id: createSandboxId('res'),
      amount: roundCurrency(amount),
      date: date.toISOString(),
      note,
    };
    state.reserveExpenses = [created, ...state.reserveExpenses];
    return ok(state, created, 201);
  }

  const reserveMatch = pathname.match(/^\/api\/reserve-expenses\/([^/]+)$/);
  if (reserveMatch && method === 'DELETE') {
    const id = decodeURIComponent(reserveMatch[1]);
    state.reserveExpenses = state.reserveExpenses.filter((e) => e.id !== id);
    return ok(state, { ok: true });
  }

  // --- Wealth assets (/api/wealth, /:id, /:id/snapshot) ---
  if (pathname === '/api/wealth' && method === 'POST') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return fail(state, 'Le nom du support est requis.');

    const category = VALID_WEALTH_CATEGORIES.has(
      body.category as WealthAssetCategory
    )
      ? (body.category as WealthAssetCategory)
      : 'SAVINGS';
    const currentValue = Math.max(0, roundCurrency(Number(body.currentValue) || 0));
    const monthlyContribution = Math.max(
      0,
      roundCurrency(Number(body.monthlyContribution) || 0)
    );
    const expectedAnnualYield = roundCurrency(
      Math.min(50, Math.max(-20, Number(body.expectedAnnualYield) || 0))
    );

    const id = createSandboxId('asset');
    const created: WealthAssetDTO = {
      id,
      name,
      category,
      currentValue,
      monthlyContribution,
      expectedAnnualYield,
      lastUpdated: nowIso,
      snapshots: [
        {
          id: createSandboxId('snap'),
          assetId: id,
          value: currentValue,
          recordedAt: nowIso,
        },
      ],
    };
    state.wealthAssets = [created, ...state.wealthAssets];
    return ok(state, created, 201);
  }

  const wealthSnapMatch = pathname.match(/^\/api\/wealth\/([^/]+)\/snapshot$/);
  if (wealthSnapMatch && method === 'POST') {
    const id = decodeURIComponent(wealthSnapMatch[1]);
    const asset = state.wealthAssets.find((a) => a.id === id);
    if (!asset) return fail(state, 'Support introuvable.', 404);

    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0) {
      return fail(state, 'Veuillez saisir une valeur positive valide.');
    }

    const rounded = roundCurrency(value);
    asset.currentValue = rounded;
    asset.lastUpdated = nowIso;
    const snapshot = {
      id: createSandboxId('snap'),
      assetId: id,
      value: rounded,
      recordedAt: nowIso,
    };
    asset.snapshots = [...(asset.snapshots ?? []), snapshot];
    return ok(state, { asset, snapshot }, 201);
  }

  const wealthMatch = pathname.match(/^\/api\/wealth\/([^/]+)$/);
  if (wealthMatch) {
    const id = decodeURIComponent(wealthMatch[1]);
    const idx = state.wealthAssets.findIndex((a) => a.id === id);
    if (idx === -1) return fail(state, 'Support introuvable.', 404);

    if (method === 'PATCH') {
      const asset = state.wealthAssets[idx];
      if (typeof body.name === 'string' && body.name.trim()) {
        asset.name = body.name.trim();
      }
      if (VALID_WEALTH_CATEGORIES.has(body.category as WealthAssetCategory)) {
        asset.category = body.category as WealthAssetCategory;
      }
      if (body.monthlyContribution !== undefined) {
        const mc = Number(body.monthlyContribution);
        if (Number.isFinite(mc) && mc >= 0) {
          asset.monthlyContribution = roundCurrency(mc);
        }
      }
      if (body.expectedAnnualYield !== undefined) {
        const y = Number(body.expectedAnnualYield);
        if (Number.isFinite(y)) {
          asset.expectedAnnualYield = roundCurrency(Math.min(50, Math.max(-20, y)));
        }
      }
      if (body.currentValue !== undefined) {
        const cv = Number(body.currentValue);
        if (Number.isFinite(cv) && cv >= 0) {
          const rounded = roundCurrency(cv);
          if (rounded !== asset.currentValue) {
            asset.currentValue = rounded;
            asset.snapshots = [
              ...(asset.snapshots ?? []),
              {
                id: createSandboxId('snap'),
                assetId: id,
                value: rounded,
                recordedAt: nowIso,
              },
            ];
          }
        }
      }
      asset.lastUpdated = nowIso;
      return ok(state, asset);
    }

    if (method === 'DELETE') {
      state.wealthAssets.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  // --- Price Tracker (/api/price-tracker, /:id, /:id/entries, /entries/:entryId) ---
  if (pathname === '/api/price-tracker' && method === 'POST') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return fail(state, 'Le nom du produit est requis.');

    const unit =
      typeof body.unit === 'string' && body.unit.trim()
        ? body.unit.trim()
        : 'unité';
    const targetAlertPercent =
      Math.round(
        Math.min(100, Math.max(0.5, Number(body.targetAlertPercent) || 5.0)) * 10
      ) / 10;
    const hasInitialPrice =
      body.initialPrice !== undefined &&
      body.initialPrice !== null &&
      body.initialPrice !== '';
    const initialPrice = hasInitialPrice ? Number(body.initialPrice) : null;
    if (
      initialPrice !== null &&
      (!Number.isFinite(initialPrice) || initialPrice <= 0)
    ) {
      return fail(state, 'Le prix initial doit être supérieur à 0 €.');
    }

    const id = createSandboxId('prod');
    const created: TrackedProductDTO = {
      id,
      name,
      unit,
      targetAlertPercent,
      createdAt: nowIso,
      entries:
        initialPrice !== null
          ? [
              {
                id: createSandboxId('pe'),
                productId: id,
                price: roundCurrency(initialPrice),
                store:
                  typeof body.initialStore === 'string' && body.initialStore.trim()
                    ? body.initialStore.trim()
                    : null,
                recordedAt: nowIso,
              },
            ]
          : [],
    };
    state.trackedProducts = [created, ...state.trackedProducts];
    return ok(state, created, 201);
  }

  const priceEntryDeleteMatch = pathname.match(
    /^\/api\/price-tracker\/entries\/([^/]+)$/
  );
  if (priceEntryDeleteMatch && method === 'DELETE') {
    const entryId = decodeURIComponent(priceEntryDeleteMatch[1]);
    state.trackedProducts = state.trackedProducts.map((p) => ({
      ...p,
      entries: p.entries.filter((e) => e.id !== entryId),
    }));
    return ok(state, { ok: true });
  }

  const priceEntriesMatch = pathname.match(
    /^\/api\/price-tracker\/([^/]+)\/entries$/
  );
  if (priceEntriesMatch && method === 'POST') {
    const productId = decodeURIComponent(priceEntriesMatch[1]);
    const product = state.trackedProducts.find((p) => p.id === productId);
    if (!product) return fail(state, 'Produit introuvable.', 404);

    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return fail(state, 'Le prix doit être supérieur à 0 €.');
    }
    const recordedAt = body.recordedAt
      ? new Date(String(body.recordedAt))
      : new Date();
    if (Number.isNaN(recordedAt.getTime())) return fail(state, 'Date invalide.');

    const entry = {
      id: createSandboxId('pe'),
      productId,
      price: roundCurrency(price),
      store:
        typeof body.store === 'string' && body.store.trim()
          ? body.store.trim()
          : null,
      recordedAt: recordedAt.toISOString(),
    };
    product.entries.push(entry);
    product.entries.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    return ok(state, entry, 201);
  }

  const priceProductMatch = pathname.match(/^\/api\/price-tracker\/([^/]+)$/);
  if (priceProductMatch) {
    const id = decodeURIComponent(priceProductMatch[1]);
    const idx = state.trackedProducts.findIndex((p) => p.id === id);
    if (idx === -1) return fail(state, 'Produit introuvable.', 404);

    if (method === 'PATCH') {
      const prod = state.trackedProducts[idx];
      if (typeof body.name === 'string' && body.name.trim()) {
        prod.name = body.name.trim();
      }
      if (typeof body.unit === 'string' && body.unit.trim()) {
        prod.unit = body.unit.trim();
      }
      if (body.targetAlertPercent !== undefined) {
        const pct = Number(body.targetAlertPercent);
        if (Number.isFinite(pct)) {
          prod.targetAlertPercent =
            Math.round(Math.min(100, Math.max(0.5, pct)) * 10) / 10;
        }
      }
      return ok(state, prod);
    }

    if (method === 'DELETE') {
      state.trackedProducts.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  // --- Taxes (/api/taxes/profile, /api/taxes/entries, /api/taxes/entries/:id) ---
  if (pathname === '/api/taxes/profile' && method === 'PATCH') {
    if (body.fiscalParts !== undefined) {
      const parts = Number(body.fiscalParts);
      if (!Number.isFinite(parts) || parts < 1 || parts > 12) {
        return fail(
          state,
          'Le nombre de parts fiscales doit être compris entre 1 et 12.'
        );
      }
      state.taxProfile.fiscalParts = Math.round(parts * 4) / 4;
    }
    if (
      body.deductionMode === 'STANDARD_10' ||
      body.deductionMode === 'ACTUAL_FEES'
    ) {
      state.taxProfile.deductionMode = body.deductionMode;
    }
    if (body.actualFeesAmount !== undefined) {
      const fees = Number(body.actualFeesAmount);
      if (Number.isFinite(fees) && fees >= 0) {
        state.taxProfile.actualFeesAmount = roundCurrency(fees);
      }
    }
    if (body.withheldTaxPaid !== undefined) {
      const withheld = Number(body.withheldTaxPaid);
      if (Number.isFinite(withheld) && withheld >= 0) {
        state.taxProfile.withheldTaxPaid = roundCurrency(withheld);
      }
    }
    state.taxProfile.updatedAt = nowIso;
    return ok(state, state.taxProfile);
  }

  if (pathname === '/api/taxes/entries' && method === 'POST') {
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) return fail(state, 'Le libellé est requis.');

    const created: TaxEntryDTO = {
      id: createSandboxId('tax'),
      year: Math.round(Number(body.year) || new Date().getFullYear()),
      category: VALID_TAX_CATEGORIES.has(body.category as TaxEntryCategory)
        ? (body.category as TaxEntryCategory)
        : 'INCOME',
      label,
      taxableBase: Math.max(0, roundCurrency(Number(body.taxableBase) || 0)),
      computedTax: Math.max(0, roundCurrency(Number(body.computedTax) || 0)),
      notes:
        typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    };
    state.taxEntries.push(created);
    return ok(state, created, 201);
  }

  const taxEntryMatch = pathname.match(/^\/api\/taxes\/entries\/([^/]+)$/);
  if (taxEntryMatch) {
    const id = decodeURIComponent(taxEntryMatch[1]);
    const idx = state.taxEntries.findIndex((e) => e.id === id);
    if (idx === -1) return fail(state, 'Poste fiscal introuvable.', 404);

    if (method === 'PATCH') {
      const item = state.taxEntries[idx];
      if (typeof body.label === 'string' && body.label.trim()) {
        item.label = body.label.trim();
      }
      if (body.year !== undefined) {
        const y = Math.round(Number(body.year));
        if (Number.isFinite(y)) item.year = y;
      }
      if (VALID_TAX_CATEGORIES.has(body.category as TaxEntryCategory)) {
        item.category = body.category as TaxEntryCategory;
      }
      if (body.taxableBase !== undefined) {
        const tb = Number(body.taxableBase);
        if (Number.isFinite(tb) && tb >= 0) item.taxableBase = roundCurrency(tb);
      }
      if (body.computedTax !== undefined) {
        const ct = Number(body.computedTax);
        if (Number.isFinite(ct) && ct >= 0) item.computedTax = roundCurrency(ct);
      }
      if (body.notes !== undefined) {
        item.notes =
          typeof body.notes === 'string' && body.notes.trim()
            ? body.notes.trim()
            : null;
      }
      return ok(state, item);
    }

    if (method === 'DELETE') {
      state.taxEntries.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  // --- Custom Indices (/api/custom-indices, /:id, /:id/points) ---
  if (pathname === '/api/custom-indices' && method === 'POST') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return fail(state, "Le nom de l'indice est requis.");

    const type: CustomIndexType = body.type === 'MANUAL' ? 'MANUAL' : 'COMPOSITE';
    const baseValue = Math.max(1, roundCurrency(Number(body.baseValue) || 100));
    const rawComponents = Array.isArray(body.components) ? body.components : [];

    if (type === 'COMPOSITE') {
      if (rawComponents.length === 0) {
        return fail(
          state,
          'Ajoutez au moins une composante pour un indice composite.'
        );
      }
      const totalWeight = rawComponents.reduce(
        (sum: number, c: { weightPercent?: unknown }) =>
          sum + (Number(c?.weightPercent) || 0),
        0
      );
      if (Math.abs(totalWeight - 100) > 0.05) {
        return fail(
          state,
          `La somme des pondérations doit être exactement égale à 100 % (actuel : ${totalWeight} %).`
        );
      }
    }

    const indexId = createSandboxId('idx');
    const created: CustomIndexDTO = {
      id: indexId,
      name,
      description:
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
      baseValue,
      type,
      createdAt: nowIso,
      components:
        type === 'COMPOSITE'
          ? rawComponents.map((raw) => {
              const c = asObject(raw);
              return {
                id: createSandboxId('icomp'),
                indexId,
                sourceType: VALID_SOURCE_TYPES.has(
                  c.sourceType as IndexComponentSourceType
                )
                  ? (c.sourceType as IndexComponentSourceType)
                  : 'MANUAL_SERIES',
                sourceId: typeof c.sourceId === 'string' ? c.sourceId : null,
                label:
                  typeof c.label === 'string' && c.label.trim()
                    ? c.label.trim()
                    : 'Composante',
                weightPercent: roundCurrency(Number(c.weightPercent) || 0),
                baseReferenceValue: Math.max(
                  0.01,
                  roundCurrency(Number(c.baseReferenceValue) || 1)
                ),
              };
            })
          : [],
      dataPoints: [
        {
          id: createSandboxId('idp'),
          indexId,
          value: baseValue,
          recordedAt: nowIso,
        },
      ],
    };
    state.customIndices = [created, ...state.customIndices];
    return ok(state, created, 201);
  }

  const indexPointsMatch = pathname.match(
    /^\/api\/custom-indices\/([^/]+)\/points$/
  );
  if (indexPointsMatch && method === 'POST') {
    const indexId = decodeURIComponent(indexPointsMatch[1]);
    const index = state.customIndices.find((i) => i.id === indexId);
    if (!index) return fail(state, 'Indice introuvable.', 404);

    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return fail(state, "La valeur de l'indice doit être supérieure à 0.");
    }
    const recordedAt = body.recordedAt
      ? new Date(String(body.recordedAt))
      : new Date();
    if (Number.isNaN(recordedAt.getTime())) return fail(state, 'Date invalide.');

    const dp = {
      id: createSandboxId('idp'),
      indexId,
      value: roundCurrency(value),
      recordedAt: recordedAt.toISOString(),
    };
    index.dataPoints.push(dp);
    index.dataPoints.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    return ok(state, dp, 201);
  }

  const indexMatch = pathname.match(/^\/api\/custom-indices\/([^/]+)$/);
  if (indexMatch && method === 'DELETE') {
    const id = decodeURIComponent(indexMatch[1]);
    state.customIndices = state.customIndices.filter((i) => i.id !== id);
    return ok(state, { ok: true });
  }

  // --- Planning canvas (/api/planning/*) ---
  if (pathname === '/api/planning/nodes' && method === 'POST') {
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : 'Nouvelle idée';
    const type = VALID_PLANNING_TYPES.has(body.type as PlanningNodeType)
      ? (body.type as PlanningNodeType)
      : 'IDEA';
    const created: PlanningNodeDTO = {
      id: createSandboxId('pnode'),
      type,
      title,
      content:
        typeof body.content === 'string' && body.content.trim()
          ? body.content.trim()
          : null,
      url:
        typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null,
      resourceKind: VALID_RESOURCE_KINDS.has(
        body.resourceKind as PlanningResourceKind
      )
        ? (body.resourceKind as PlanningResourceKind)
        : null,
      positionX: Number.isFinite(Number(body.positionX))
        ? Number(body.positionX)
        : 0,
      positionY: Number.isFinite(Number(body.positionY))
        ? Number(body.positionY)
        : 0,
      createdAt: nowIso,
    };
    state.planningNodes = [...(state.planningNodes ?? []), created];
    return ok(state, created, 201);
  }

  const planningNodeMatch = pathname.match(/^\/api\/planning\/nodes\/([^/]+)$/);
  if (planningNodeMatch) {
    const id = decodeURIComponent(planningNodeMatch[1]);
    const nodes = state.planningNodes ?? [];
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx === -1) return fail(state, 'Nœud introuvable.', 404);

    if (method === 'PATCH') {
      const node = nodes[idx];
      if (typeof body.title === 'string') {
        node.title = body.title.trim() || 'Sans titre';
      }
      if (body.content !== undefined) {
        node.content =
          typeof body.content === 'string' && body.content.trim()
            ? body.content.trim()
            : null;
      }
      if (VALID_PLANNING_TYPES.has(body.type as PlanningNodeType)) {
        node.type = body.type as PlanningNodeType;
      }
      if (body.url !== undefined) {
        node.url =
          typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null;
      }
      if (body.resourceKind !== undefined) {
        node.resourceKind = VALID_RESOURCE_KINDS.has(
          body.resourceKind as PlanningResourceKind
        )
          ? (body.resourceKind as PlanningResourceKind)
          : null;
      }
      if (body.positionX !== undefined && Number.isFinite(Number(body.positionX))) {
        node.positionX = Number(body.positionX);
      }
      if (body.positionY !== undefined && Number.isFinite(Number(body.positionY))) {
        node.positionY = Number(body.positionY);
      }
      state.planningNodes = nodes;
      return ok(state, node);
    }

    if (method === 'DELETE') {
      state.planningNodes = nodes.filter((n) => n.id !== id);
      state.planningEdges = (state.planningEdges ?? []).filter(
        (e) => e.sourceId !== id && e.targetId !== id
      );
      return ok(state, { ok: true });
    }
  }

  if (pathname === '/api/planning/edges' && method === 'POST') {
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    if (!sourceId || !targetId || sourceId === targetId) {
      return fail(state, 'Connexion invalide entre deux nœuds.');
    }
    const edges = state.planningEdges ?? [];
    const existing = edges.find(
      (e) => e.sourceId === sourceId && e.targetId === targetId
    );
    if (existing) return ok(state, existing);

    const created: PlanningEdgeDTO = {
      id: createSandboxId('pedge'),
      sourceId,
      targetId,
      label:
        typeof body.label === 'string' && body.label.trim()
          ? body.label.trim()
          : null,
    };
    state.planningEdges = [...edges, created];
    return ok(state, created, 201);
  }

  const planningEdgeMatch = pathname.match(/^\/api\/planning\/edges\/([^/]+)$/);
  if (planningEdgeMatch) {
    const id = decodeURIComponent(planningEdgeMatch[1]);
    const edges = state.planningEdges ?? [];
    const idx = edges.findIndex((e) => e.id === id);
    if (idx === -1) return fail(state, 'Connexion introuvable.', 404);

    if (method === 'PATCH') {
      const edge = edges[idx];
      edge.label =
        typeof body.label === 'string' && body.label.trim()
          ? body.label.trim()
          : null;
      state.planningEdges = edges;
      return ok(state, edge);
    }

    if (method === 'DELETE') {
      state.planningEdges = edges.filter((e) => e.id !== id);
      return ok(state, { ok: true });
    }
  }

  // --- Financial Projects (/api/projects, /api/projects/:id) ---
  if (pathname === '/api/projects' && method === 'POST') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const currentPrice = Number(body.currentPrice);
    if (!name) return fail(state, 'Le nom du projet est requis.');
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return fail(state, 'Le prix actuel du bien doit être supérieur à 0 €.');
    }

    const useLoan = Boolean(body.useLoan);
    const created: FinancialProjectDTO = {
      id: createSandboxId('proj'),
      name,
      category: VALID_PROJECT_CATEGORIES.has(
        body.category as FinancialProjectCategory
      )
        ? (body.category as FinancialProjectCategory)
        : 'OTHER',
      currentPrice: roundCurrency(currentPrice),
      extraFeesPercent:
        Math.round(
          Math.min(50, Math.max(0, Number(body.extraFeesPercent) || 0)) * 10
        ) / 10,
      annualPriceGrowthPercent:
        Math.round(
          Math.min(
            30,
            Math.max(-50, Number(body.annualPriceGrowthPercent) || 0)
          ) * 10
        ) / 10,
      targetMonths: Math.min(
        480,
        Math.max(1, Math.round(Number(body.targetMonths) || 24))
      ),
      savedAmount: Math.max(0, roundCurrency(Number(body.savedAmount) || 0)),
      useLoan,
      downPaymentPercent:
        Math.round(
          Math.min(
            100,
            Math.max(0, Number(body.downPaymentPercent ?? (useLoan ? 20 : 100)))
          ) * 10
        ) / 10,
      loanInterestRate: roundCurrency(
        Math.min(25, Math.max(0, Number(body.loanInterestRate ?? 3.5)))
      ),
      loanDurationYears: Math.min(
        35,
        Math.max(1, Math.round(Number(body.loanDurationYears ?? 20)))
      ),
      createdAt: nowIso,
    };
    state.financialProjects = [created, ...state.financialProjects];
    return ok(state, created, 201);
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const id = decodeURIComponent(projectMatch[1]);
    const idx = state.financialProjects.findIndex((p) => p.id === id);
    if (idx === -1) return fail(state, 'Projet financier introuvable.', 404);

    if (method === 'PATCH') {
      const proj = state.financialProjects[idx];
      if (typeof body.name === 'string' && body.name.trim()) {
        proj.name = body.name.trim();
      }
      if (
        VALID_PROJECT_CATEGORIES.has(body.category as FinancialProjectCategory)
      ) {
        proj.category = body.category as FinancialProjectCategory;
      }
      if (body.currentPrice !== undefined) {
        const cp = Number(body.currentPrice);
        if (Number.isFinite(cp) && cp > 0) proj.currentPrice = roundCurrency(cp);
      }
      if (body.extraFeesPercent !== undefined) {
        const ef = Number(body.extraFeesPercent);
        if (Number.isFinite(ef)) {
          proj.extraFeesPercent =
            Math.round(Math.min(50, Math.max(0, ef)) * 10) / 10;
        }
      }
      if (body.annualPriceGrowthPercent !== undefined) {
        const g = Number(body.annualPriceGrowthPercent);
        if (Number.isFinite(g)) {
          proj.annualPriceGrowthPercent =
            Math.round(Math.min(30, Math.max(-50, g)) * 10) / 10;
        }
      }
      if (body.targetMonths !== undefined) {
        const tm = Math.round(Number(body.targetMonths));
        if (Number.isFinite(tm) && tm >= 1) {
          proj.targetMonths = Math.min(480, Math.max(1, tm));
        }
      }
      if (body.addSavings !== undefined) {
        const delta = Number(body.addSavings);
        if (Number.isFinite(delta)) {
          proj.savedAmount = Math.max(0, roundCurrency(proj.savedAmount + delta));
        }
      } else if (body.savedAmount !== undefined) {
        const sa = Number(body.savedAmount);
        if (Number.isFinite(sa) && sa >= 0) {
          proj.savedAmount = roundCurrency(sa);
        }
      }
      if (typeof body.useLoan === 'boolean') proj.useLoan = body.useLoan;
      if (body.downPaymentPercent !== undefined) {
        const dp = Number(body.downPaymentPercent);
        if (Number.isFinite(dp)) {
          proj.downPaymentPercent =
            Math.round(Math.min(100, Math.max(0, dp)) * 10) / 10;
        }
      }
      if (body.loanInterestRate !== undefined) {
        const lr = Number(body.loanInterestRate);
        if (Number.isFinite(lr)) {
          proj.loanInterestRate = roundCurrency(Math.min(25, Math.max(0, lr)));
        }
      }
      if (body.loanDurationYears !== undefined) {
        const dy = Math.round(Number(body.loanDurationYears));
        if (Number.isFinite(dy) && dy >= 1) {
          proj.loanDurationYears = Math.min(35, Math.max(1, dy));
        }
      }
      return ok(state, proj);
    }

    if (method === 'DELETE') {
      state.financialProjects.splice(idx, 1);
      return ok(state, { ok: true });
    }
  }

  return fail(
    state,
    `Endpoint "${method} ${pathname}" non pris en charge en Mode Test.`,
    404
  );
}

/**
 * Pure client-only equivalent of `importTransactionsAction`.
 */
export function applySandboxImportTransactions(
  currentState: AppBootstrapData,
  rows: ImportTransactionRowPayload[]
): { state: AppBootstrapData; result: ImportTransactionsActionResult } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      state: currentState,
      result: { ok: false, error: 'Aucune transaction valide à importer.' },
    };
  }

  const state = structuredClone(currentState);
  const categoryMap = new Map<string, CategoryDTO>();
  let nextSortOrder = state.categories.reduce(
    (max, c) => Math.max(max, c.sortOrder),
    0
  );

  for (const cat of state.categories) {
    categoryMap.set(normalizeCategoryKey(cat.name), cat);
  }

  let createdCategoriesCount = 0;
  let importedCount = 0;

  for (const row of rows) {
    const amount = roundCurrency(Number(row.amount));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const date = new Date(row.dateIso);
    if (Number.isNaN(date.getTime())) continue;

    const type = row.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const rawCatName = (row.categoryName || '').trim() || 'Autre';
    const key = normalizeCategoryKey(rawCatName);

    let resolvedCategoryId = row.categoryId || null;
    if (!resolvedCategoryId) {
      const existing = categoryMap.get(key);
      if (existing) {
        resolvedCategoryId = existing.id;
      } else {
        nextSortOrder += 1;
        const newCat: CategoryDTO = {
          id: createSandboxId('cat'),
          name: rawCatName,
          type,
          color:
            AUTO_CATEGORY_COLORS[
              createdCategoriesCount % AUTO_CATEGORY_COLORS.length
            ],
          icon: type === 'INCOME' ? 'Wallet' : 'Tag',
          monthlyLimit: 0,
          alertThreshold: 80,
          isArchived: false,
          sortOrder: nextSortOrder,
        };
        state.categories.push(newCat);
        categoryMap.set(key, newCat);
        resolvedCategoryId = newCat.id;
        createdCategoriesCount += 1;
      }
    }

    state.transactions.push({
      id: createSandboxId('tx'),
      amount,
      type,
      date: date.toISOString(),
      note: row.note && row.note.trim() ? row.note.trim() : null,
      categoryId: resolvedCategoryId,
      recurringPaymentId: null,
      billingMonth: null,
    });
    importedCount += 1;
  }

  state.transactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    state,
    result: {
      ok: true,
      importedCount,
      createdCategoriesCount,
    },
  };
}

/**
 * Pure client-only equivalent of `closeMonthAction`.
 */
export function applySandboxCloseMonth(
  currentState: AppBootstrapData,
  input: CloseMonthActionInput
): { state: AppBootstrapData; result: CloseMonthActionResult } {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return {
      state: currentState,
      result: { ok: false, error: 'Format de mois invalide (attendu AAAA-MM).' },
    };
  }

  const state = structuredClone(currentState);
  const nowIso = new Date().toISOString();
  let updatedAssetsCount = 0;

  for (const upd of input.assetUpdates) {
    const asset = state.wealthAssets.find((a) => a.id === upd.assetId);
    if (!asset) continue;
    const roundedValue = Math.max(0, roundCurrency(upd.newValue));
    asset.currentValue = roundedValue;
    asset.lastUpdated = nowIso;
    asset.snapshots = [
      ...(asset.snapshots ?? []),
      {
        id: createSandboxId('snap'),
        assetId: asset.id,
        value: roundedValue,
        recordedAt: nowIso,
      },
    ];
    updatedAssetsCount += 1;
  }

  let createdPricesCount = 0;
  for (const pe of input.priceEntries) {
    const product = state.trackedProducts.find((p) => p.id === pe.productId);
    if (!product || !Number.isFinite(pe.price) || pe.price <= 0) continue;
    product.entries.push({
      id: createSandboxId('pe'),
      productId: product.id,
      price: roundCurrency(pe.price),
      store: pe.store?.trim() || null,
      recordedAt: nowIso,
    });
    product.entries.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    createdPricesCount += 1;
  }

  const reportPayload: MonthlyReportDTO = {
    id:
      state.monthlyReports.find((r) => r.month === input.month)?.id ??
      createSandboxId('rep'),
    month: input.month,
    totalIncome: roundCurrency(input.totalIncome),
    totalExpenses: roundCurrency(input.totalExpenses),
    reserveAmount: roundCurrency(input.reserveAmount),
    netWorthEnd: roundCurrency(input.netWorthEnd),
    personalInflation: Math.round(input.personalInflation * 10) / 10,
    notes: input.notes?.trim() || null,
    closedAt: nowIso,
  };

  const existingReportIdx = state.monthlyReports.findIndex(
    (r) => r.month === input.month
  );
  if (existingReportIdx >= 0) {
    state.monthlyReports[existingReportIdx] = reportPayload;
  } else {
    state.monthlyReports.push(reportPayload);
    state.monthlyReports.sort((a, b) => b.month.localeCompare(a.month));
  }

  return {
    state,
    result: {
      ok: true,
      report: reportPayload,
      updatedAssetsCount,
      createdPricesCount,
    },
  };
}
