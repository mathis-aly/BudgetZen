import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function makeDate(year: number, monthIndex: number, day: number): Date {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, maxDay));
  return new Date(year, monthIndex, safeDay, 12, 0, 0, 0);
}

async function main() {
  console.log('🌱 Initialisation de la base de données BudgetZen...');

  // Clean slate for reproducible seed
  await prisma.indexDataPoint.deleteMany();
  await prisma.indexComponent.deleteMany();
  await prisma.customIndex.deleteMany();
  await prisma.taxEntry.deleteMany();
  await prisma.taxProfile.deleteMany();
  await prisma.monthlyReport.deleteMany();
  await prisma.priceEntry.deleteMany();
  await prisma.trackedProduct.deleteMany();
  await prisma.assetSnapshot.deleteMany();
  await prisma.wealthAsset.deleteMany();
  await prisma.reserveExpense.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringPayment.deleteMany();
  await prisma.category.deleteMany();
  await prisma.accountSettings.deleteMany();

  // 1. Account & User Settings
  await prisma.accountSettings.create({
    data: {
      id: 'default',
      accountName: 'Compte Courant',
      initialBalance: 820,
      currency: 'EUR',
      monthlyIncomeTarget: 2950,
    },
  });

  await prisma.userSettings.create({
    data: {
      id: 1,
      mandatoryReserveRate: 10.0,
      manualInflationRate: 2.5,
    },
  });

  // 2. Categories (Expense & Income)
  const catLogement = await prisma.category.create({
    data: {
      name: 'Logement & Énergie',
      type: 'EXPENSE',
      color: '#007AFF',
      icon: 'Home',
      monthlyLimit: 980,
      alertThreshold: 95,
      sortOrder: 1,
    },
  });

  const catCourses = await prisma.category.create({
    data: {
      name: 'Courses',
      type: 'EXPENSE',
      color: '#34C759',
      icon: 'ShoppingCart',
      monthlyLimit: 420,
      alertThreshold: 80,
      sortOrder: 2,
    },
  });

  const catResto = await prisma.category.create({
    data: {
      name: 'Restaurants & Sorties',
      type: 'EXPENSE',
      color: '#FF9500',
      icon: 'Utensils',
      monthlyLimit: 200,
      alertThreshold: 80,
      sortOrder: 3,
    },
  });

  const catTransports = await prisma.category.create({
    data: {
      name: 'Transports',
      type: 'EXPENSE',
      color: '#5856D6',
      icon: 'Car',
      monthlyLimit: 150,
      alertThreshold: 80,
      sortOrder: 4,
    },
  });

  const catAbonnements = await prisma.category.create({
    data: {
      name: 'Abonnements',
      type: 'EXPENSE',
      color: '#FF2D55',
      icon: 'Tv',
      monthlyLimit: 110,
      alertThreshold: 85,
      sortOrder: 5,
    },
  });

  const catShopping = await prisma.category.create({
    data: {
      name: 'Shopping',
      type: 'EXPENSE',
      color: '#AF52DE',
      icon: 'ShoppingBag',
      monthlyLimit: 220,
      alertThreshold: 80,
      sortOrder: 6,
    },
  });

  const catLoisirs = await prisma.category.create({
    data: {
      name: 'Loisirs & Sport',
      type: 'EXPENSE',
      color: '#00C7BE',
      icon: 'Dumbbell',
      monthlyLimit: 140,
      alertThreshold: 80,
      sortOrder: 7,
    },
  });

  const catSante = await prisma.category.create({
    data: {
      name: 'Santé',
      type: 'EXPENSE',
      color: '#FF3B30',
      icon: 'HeartPulse',
      monthlyLimit: 90,
      alertThreshold: 80,
      sortOrder: 8,
    },
  });

  const catSalaire = await prisma.category.create({
    data: {
      name: 'Salaire',
      type: 'INCOME',
      color: '#30D158',
      icon: 'Briefcase',
      monthlyLimit: 0,
      alertThreshold: 80,
      sortOrder: 9,
    },
  });

  const catFreelance = await prisma.category.create({
    data: {
      name: 'Revenus annexes',
      type: 'INCOME',
      color: '#32ADE6',
      icon: 'Sparkles',
      monthlyLimit: 0,
      alertThreshold: 80,
      sortOrder: 10,
    },
  });

  // Reference current date dynamically
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const curDay = now.getDate();
  const currentMonthKey = getMonthKey(now);
  const prevMonthDate = new Date(curYear, curMonth - 1, 1);
  const prevMonthKey = getMonthKey(prevMonthDate);

  const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const clampSoonDay = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.getDate();
  };

  // Determine days that fall within the next 7 days (and within current month when possible)
  const daySoon1 = curDay + 1 <= daysInCurMonth ? curDay + 1 : curDay;
  const daySoon2 = curDay + 3 <= daysInCurMonth ? curDay + 3 : clampSoonDay(3);
  const daySoon3 = curDay + 5 <= daysInCurMonth ? curDay + 5 : clampSoonDay(5);

  // 3. Recurring Payments (some already paid this month, some upcoming in next 7 days!)
  const recLoyer = await prisma.recurringPayment.create({
    data: {
      title: 'Loyer Appartement',
      amount: 860,
      dayOfMonth: 5,
      categoryId: catLogement.id,
      isActive: true,
      note: 'Virement automatique propriétaire',
      lastPaidMonth: curDay >= 5 ? currentMonthKey : prevMonthKey,
    },
  });

  const recElectricite = await prisma.recurringPayment.create({
    data: {
      title: 'Électricité & Gaz (EDF)',
      amount: 78,
      dayOfMonth: daySoon1,
      categoryId: catLogement.id,
      isActive: true,
      note: 'Mensualité lissée',
      lastPaidMonth: prevMonthKey, // Unpaid this month -> due very soon!
    },
  });

  const recFibre = await prisma.recurringPayment.create({
    data: {
      title: 'Fibre & Mobile',
      amount: 45.99,
      dayOfMonth: daySoon2,
      categoryId: catAbonnements.id,
      isActive: true,
      note: 'Forfait box + 5G',
      lastPaidMonth: prevMonthKey,
    },
  });

  const recNavigo = await prisma.recurringPayment.create({
    data: {
      title: 'Pass Transports',
      amount: 86.4,
      dayOfMonth: 4,
      categoryId: catTransports.id,
      isActive: true,
      note: 'Abonnement mensuel',
      lastPaidMonth: curDay >= 4 ? currentMonthKey : prevMonthKey,
    },
  });

  const recStreaming = await prisma.recurringPayment.create({
    data: {
      title: 'Apple One & Spotify',
      amount: 29.95,
      dayOfMonth: daySoon3,
      categoryId: catAbonnements.id,
      isActive: true,
      note: 'iCloud+, Music, TV+',
      lastPaidMonth: prevMonthKey,
    },
  });

  const recSport = await prisma.recurringPayment.create({
    data: {
      title: 'Salle de sport',
      amount: 39.9,
      dayOfMonth: 12,
      categoryId: catLoisirs.id,
      isActive: true,
      note: 'Abonnement Basic-Fit',
      lastPaidMonth: curDay >= 12 ? currentMonthKey : prevMonthKey,
    },
  });

  // 4. Historical Transactions (3 previous months for Analytics & Optimizer averages)
  const historicalTxData: Array<{
    amount: number;
    type: 'EXPENSE' | 'INCOME';
    date: Date;
    note: string;
    categoryId: string;
  }> = [];

  for (let offset = 4; offset >= 1; offset--) {
    const d = new Date(curYear, curMonth - offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();

    // Income
    historicalTxData.push(
      { amount: 2850, type: 'INCOME', date: makeDate(y, m, 1), note: 'Salaire mensuel', categoryId: catSalaire.id },
      { amount: offset % 2 === 0 ? 220 : 120, type: 'INCOME', date: makeDate(y, m, 18), note: 'Mission conseil', categoryId: catFreelance.id }
    );

    // Fixed charges
    historicalTxData.push(
      { amount: 860, type: 'EXPENSE', date: makeDate(y, m, 5), note: 'Loyer Appartement', categoryId: catLogement.id },
      { amount: 78, type: 'EXPENSE', date: makeDate(y, m, 15), note: 'Électricité & Gaz (EDF)', categoryId: catLogement.id },
      { amount: 86.4, type: 'EXPENSE', date: makeDate(y, m, 4), note: 'Pass Transports', categoryId: catTransports.id },
      { amount: 45.99, type: 'EXPENSE', date: makeDate(y, m, 16), note: 'Fibre & Mobile', categoryId: catAbonnements.id },
      { amount: 29.95, type: 'EXPENSE', date: makeDate(y, m, 22), note: 'Apple One & Spotify', categoryId: catAbonnements.id },
      { amount: 39.9, type: 'EXPENSE', date: makeDate(y, m, 12), note: 'Salle de sport', categoryId: catLoisirs.id }
    );

    // Variable expenses (steady historical baseline so current month surge in Restaurants stands out!)
    historicalTxData.push(
      { amount: 350 + offset * 8, type: 'EXPENSE', date: makeDate(y, m, 10), note: 'Courses mensuelles', categoryId: catCourses.id },
      { amount: 145 + (offset % 2) * 15, type: 'EXPENSE', date: makeDate(y, m, 14), note: 'Sorties & restaurants', categoryId: catResto.id },
      { amount: 110 + offset * 10, type: 'EXPENSE', date: makeDate(y, m, 19), note: 'Achats vêtements & maison', categoryId: catShopping.id },
      { amount: 45, type: 'EXPENSE', date: makeDate(y, m, 21), note: 'Cinéma & livres', categoryId: catLoisirs.id },
      { amount: 32, type: 'EXPENSE', date: makeDate(y, m, 24), note: 'Pharmacie', categoryId: catSante.id }
    );
  }

  await prisma.transaction.createMany({ data: historicalTxData });

  // 5. Current Month Transactions
  // Crafted so:
  // - Restaurants & Sorties = 232 € / 200 € (RED 116%, AND +50% surge vs historical avg!)
  // - Courses = 368 € / 420 € (ORANGE 87.6% -> daily remaining budget tip!)
  // - Shopping = 58 € / 220 € (GREEN 26.4% -> comfortable surplus for rebalancing tip!)
  // - Transports = 114.40 € / 150 € (GREEN 76.3%)
  // - Loisirs = 74.90 € / 140 € (GREEN 53.5%)
  const safeDay = (d: number) => Math.min(d, Math.max(1, curDay));

  const currentMonthTxData = [
    {
      amount: 2920,
      type: 'INCOME',
      date: makeDate(curYear, curMonth, 1),
      note: 'Salaire mensuel',
      categoryId: catSalaire.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 180,
      type: 'INCOME',
      date: makeDate(curYear, curMonth, safeDay(14)),
      note: 'Remboursement notes de frais',
      categoryId: catFreelance.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    // Paid recurring items
    ...(curDay >= 5
      ? [
          {
            amount: 860,
            type: 'EXPENSE',
            date: makeDate(curYear, curMonth, 5),
            note: 'Loyer Appartement',
            categoryId: catLogement.id,
            recurringPaymentId: recLoyer.id,
            billingMonth: currentMonthKey,
          },
        ]
      : []),
    ...(curDay >= 4
      ? [
          {
            amount: 86.4,
            type: 'EXPENSE',
            date: makeDate(curYear, curMonth, 4),
            note: 'Pass Transports',
            categoryId: catTransports.id,
            recurringPaymentId: recNavigo.id,
            billingMonth: currentMonthKey,
          },
        ]
      : []),
    ...(curDay >= 12
      ? [
          {
            amount: 39.9,
            type: 'EXPENSE',
            date: makeDate(curYear, curMonth, 12),
            note: 'Salle de sport',
            categoryId: catLoisirs.id,
            recurringPaymentId: recSport.id,
            billingMonth: currentMonthKey,
          },
        ]
      : []),
    // Courses (Total: 368 € / 420 € -> ORANGE 87.6%)
    {
      amount: 118.5,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(3)),
      note: 'Monoprix — courses de la semaine',
      categoryId: catCourses.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 94.2,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(10)),
      note: 'Grand Frais & marché bio',
      categoryId: catCourses.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 87.3,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(17)),
      note: 'Carrefour City',
      categoryId: catCourses.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 68.0,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(23)),
      note: 'Boulangerie & primeur',
      categoryId: catCourses.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    // Restaurants & Sorties (Total: 232 € / 200 € -> RED 116%)
    {
      amount: 64.0,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(6)),
      note: 'Dîner italien entre amis',
      categoryId: catResto.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 42.5,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(11)),
      note: 'Brunch du dimanche',
      categoryId: catResto.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 78.5,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(19)),
      note: 'Bistrot anniversaire',
      categoryId: catResto.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    {
      amount: 47.0,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(24)),
      note: 'Sushis & verre en terrasse',
      categoryId: catResto.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    // Shopping (Total: 58 € / 220 € -> GREEN 26.4%)
    {
      amount: 58.0,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(15)),
      note: 'Accessoires bureau',
      categoryId: catShopping.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    // Transports extra
    {
      amount: 28.0,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(20)),
      note: 'VTC retour soirée',
      categoryId: catTransports.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    // Loisirs extra
    {
      amount: 35.0,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(18)),
      note: 'Places cinéma & expo',
      categoryId: catLoisirs.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
    // Santé
    {
      amount: 26.5,
      type: 'EXPENSE',
      date: makeDate(curYear, curMonth, safeDay(9)),
      note: 'Pharmacie',
      categoryId: catSante.id,
      recurringPaymentId: null,
      billingMonth: null,
    },
  ];

  await prisma.transaction.createMany({ data: currentMonthTxData });

  // 6. Previous Calendar Year Reference Transactions (for Personal Inflation calculation)
  const prevYear = curYear - 1;
  const prevYearTxData: Array<{
    amount: number;
    type: 'EXPENSE' | 'INCOME';
    date: Date;
    note: string;
    categoryId: string;
  }> = [];

  for (const m of [2, 5, 8]) {
    prevYearTxData.push(
      { amount: 2780, type: 'INCOME', date: makeDate(prevYear, m, 1), note: 'Salaire mensuel', categoryId: catSalaire.id },
      { amount: 840, type: 'EXPENSE', date: makeDate(prevYear, m, 5), note: 'Loyer Appartement', categoryId: catLogement.id },
      { amount: 72, type: 'EXPENSE', date: makeDate(prevYear, m, 15), note: 'Électricité & Gaz (EDF)', categoryId: catLogement.id },
      { amount: 84.1, type: 'EXPENSE', date: makeDate(prevYear, m, 4), note: 'Pass Transports', categoryId: catTransports.id },
      { amount: 42.99, type: 'EXPENSE', date: makeDate(prevYear, m, 16), note: 'Fibre & Mobile', categoryId: catAbonnements.id },
      { amount: 26.95, type: 'EXPENSE', date: makeDate(prevYear, m, 22), note: 'Apple One & Spotify', categoryId: catAbonnements.id },
      { amount: 345, type: 'EXPENSE', date: makeDate(prevYear, m, 11), note: 'Courses mensuelles', categoryId: catCourses.id },
      { amount: 142, type: 'EXPENSE', date: makeDate(prevYear, m, 17), note: 'Restaurants & sorties', categoryId: catResto.id },
      { amount: 115, type: 'EXPENSE', date: makeDate(prevYear, m, 20), note: 'Shopping', categoryId: catShopping.id },
      { amount: 76, type: 'EXPENSE', date: makeDate(prevYear, m, 22), note: 'Loisirs & sport', categoryId: catLoisirs.id },
      { amount: 29, type: 'EXPENSE', date: makeDate(prevYear, m, 25), note: 'Pharmacie', categoryId: catSante.id }
    );
  }
  await prisma.transaction.createMany({ data: prevYearTxData });

  // 7. Wealth Assets & Historical Snapshots
  const livretA = await prisma.wealthAsset.create({
    data: {
      name: 'Livret A',
      category: 'SAVINGS',
      currentValue: 8500,
      monthlyContribution: 150,
      expectedAnnualYield: 3.0,
      lastUpdated: now,
    },
  });

  const peaWorld = await prisma.wealthAsset.create({
    data: {
      name: 'PEA ETF Monde (MSCI World)',
      category: 'STOCKS',
      currentValue: 14200,
      monthlyContribution: 350,
      expectedAnnualYield: 7.5,
      lastUpdated: now,
    },
  });

  const scpi = await prisma.wealthAsset.create({
    data: {
      name: 'SCPI Pierre Rendement',
      category: 'REAL_ESTATE',
      currentValue: 5000,
      monthlyContribution: 100,
      expectedAnnualYield: 5.2,
      lastUpdated: now,
    },
  });

  await prisma.assetSnapshot.createMany({
    data: [
      { assetId: livretA.id, value: 8050, recordedAt: makeDate(curYear, curMonth - 3, 1) },
      { assetId: livretA.id, value: 8200, recordedAt: makeDate(curYear, curMonth - 2, 1) },
      { assetId: livretA.id, value: 8350, recordedAt: makeDate(curYear, curMonth - 1, 1) },
      { assetId: livretA.id, value: 8500, recordedAt: now },
      { assetId: peaWorld.id, value: 12650, recordedAt: makeDate(curYear, curMonth - 3, 1) },
      { assetId: peaWorld.id, value: 13180, recordedAt: makeDate(curYear, curMonth - 2, 1) },
      { assetId: peaWorld.id, value: 13690, recordedAt: makeDate(curYear, curMonth - 1, 1) },
      { assetId: peaWorld.id, value: 14200, recordedAt: now },
      { assetId: scpi.id, value: 4700, recordedAt: makeDate(curYear, curMonth - 3, 1) },
      { assetId: scpi.id, value: 4800, recordedAt: makeDate(curYear, curMonth - 2, 1) },
      { assetId: scpi.id, value: 4900, recordedAt: makeDate(curYear, curMonth - 1, 1) },
      { assetId: scpi.id, value: 5000, recordedAt: now },
    ],
  });

  // 8. Tracked Products & Price History ("Panier Témoin")
  const trackedProductsSeed = [
    {
      name: "Huile d'olive vierge extra",
      unit: '75 cl',
      targetAlertPercent: 5.0,
      entries: [
        { monthsAgo: 10, price: 7.45, store: 'Carrefour' },
        { monthsAgo: 7, price: 8.2, store: 'Monoprix' },
        { monthsAgo: 4, price: 8.9, store: 'Carrefour' },
        { monthsAgo: 1, price: 9.35, store: 'Grand Frais' },
        { monthsAgo: 0, price: 9.6, store: 'Carrefour' },
      ],
    },
    {
      name: 'Café en grains Bio',
      unit: '1 kg',
      targetAlertPercent: 5.0,
      entries: [
        { monthsAgo: 10, price: 16.9, store: 'Biocoop' },
        { monthsAgo: 6, price: 17.5, store: 'Biocoop' },
        { monthsAgo: 3, price: 18.4, store: 'Monoprix' },
        { monthsAgo: 0, price: 18.9, store: 'Biocoop' },
      ],
    },
    {
      name: 'Œufs plein air',
      unit: 'boîte de 12',
      targetAlertPercent: 5.0,
      entries: [
        { monthsAgo: 9, price: 3.85, store: 'Marché local' },
        { monthsAgo: 5, price: 3.95, store: 'Grand Frais' },
        { monthsAgo: 2, price: 4.1, store: 'Monoprix' },
        { monthsAgo: 0, price: 4.2, store: 'Grand Frais' },
      ],
    },
    {
      name: 'Essence SP95-E10',
      unit: '1 L',
      targetAlertPercent: 5.0,
      entries: [
        { monthsAgo: 9, price: 1.88, store: 'TotalEnergies' },
        { monthsAgo: 6, price: 1.83, store: 'Carrefour Station' },
        { monthsAgo: 3, price: 1.79, store: 'TotalEnergies' },
        { monthsAgo: 0, price: 1.74, store: 'Carrefour Station' },
      ],
    },
    {
      name: 'Pâtes complètes',
      unit: '500 g',
      targetAlertPercent: 5.0,
      entries: [
        { monthsAgo: 8, price: 1.65, store: 'Carrefour' },
        { monthsAgo: 4, price: 1.69, store: 'Monoprix' },
        { monthsAgo: 0, price: 1.72, store: 'Carrefour' },
      ],
    },
  ];

  const createdTrackedProducts: Array<{ id: string; name: string; firstPrice: number }> = [];

  for (const item of trackedProductsSeed) {
    const createdProd = await prisma.trackedProduct.create({
      data: {
        name: item.name,
        unit: item.unit,
        targetAlertPercent: item.targetAlertPercent,
        entries: {
          create: item.entries.map((e) => ({
            price: e.price,
            store: e.store,
            recordedAt:
              e.monthsAgo === 0
                ? now
                : makeDate(curYear, curMonth - e.monthsAgo, 15),
          })),
        },
      },
    });
    createdTrackedProducts.push({
      id: createdProd.id,
      name: createdProd.name,
      firstPrice: item.entries[0].price,
    });
  }

  // 9. Historical Closed Monthly Reports (2 previous months for comparative cards)
  const twoMonthsAgoDate = new Date(curYear, curMonth - 2, 1);
  const oneMonthAgoDate = new Date(curYear, curMonth - 1, 1);

  await prisma.monthlyReport.createMany({
    data: [
      {
        month: getMonthKey(twoMonthsAgoDate),
        totalIncome: 3070,
        totalExpenses: 1858.24,
        reserveAmount: 307,
        netWorthEnd: 27840,
        personalInflation: 3.1,
        notes: 'Mois équilibré · Surplus affecté au PEA ETF Monde (+350 €).',
        closedAt: makeDate(
          twoMonthsAgoDate.getFullYear(),
          twoMonthsAgoDate.getMonth(),
          28
        ),
      },
      {
        month: getMonthKey(oneMonthAgoDate),
        totalIncome: 2970,
        totalExpenses: 1825.24,
        reserveAmount: 297,
        netWorthEnd: 29190,
        personalInflation: 3.4,
        notes: 'Réserve de sécurité intacte · Hausse légère sur les courses.',
        closedAt: makeDate(
          oneMonthAgoDate.getFullYear(),
          oneMonthAgoDate.getMonth(),
          30
        ),
      },
    ],
  });

  // 10. Tax Profile & Entries (Module Fiscalité 2026)
  await prisma.taxProfile.create({
    data: {
      id: 1,
      fiscalParts: 1.0,
      deductionMode: 'STANDARD_10',
      actualFeesAmount: 0,
      withheldTaxPaid: 2650,
    },
  });

  await prisma.taxEntry.createMany({
    data: [
      {
        year: curYear,
        category: 'INCOME',
        label: 'Salaires nets imposables annuels',
        taxableBase: 35040,
        computedTax: 0,
        notes: 'Estimation basée sur le cumul net fiscal mensuel',
      },
      {
        year: curYear,
        category: 'INCOME',
        label: 'Revenus annexes / Missions conseil',
        taxableBase: 1920,
        computedTax: 0,
        notes: 'Activité complémentaire déclarée',
      },
      {
        year: curYear,
        category: 'CAPITAL',
        label: 'Dividendes & intérêts imposables (CTO / Livrets)',
        taxableBase: 1450,
        computedTax: 455.3,
        notes: 'Soumis au PFU 31,4 % (ou option 2OP)',
      },
      {
        year: curYear,
        category: 'LOCAL',
        label: 'Taxe foncière (résidence principale)',
        taxableBase: 0,
        computedTax: 890,
        notes: 'Échéance octobre',
      },
    ],
  });

  // 11. Custom Indices (1 Composite + 1 Manual with 12-month history)
  const oliveProd = createdTrackedProducts[0];
  const coffeeProd = createdTrackedProducts[1];
  const fuelProd = createdTrackedProducts[3];

  await prisma.customIndex.create({
    data: {
      name: 'Indice Coût de la Vie Perso',
      description:
        'Indice composite pondéré basé sur votre panier témoin (huile, café, carburant).',
      baseValue: 100.0,
      type: 'COMPOSITE',
      components: {
        create: [
          {
            sourceType: 'TRACKED_PRODUCT',
            sourceId: oliveProd.id,
            label: oliveProd.name,
            weightPercent: 40,
            baseReferenceValue: oliveProd.firstPrice,
          },
          {
            sourceType: 'TRACKED_PRODUCT',
            sourceId: coffeeProd.id,
            label: coffeeProd.name,
            weightPercent: 35,
            baseReferenceValue: coffeeProd.firstPrice,
          },
          {
            sourceType: 'TRACKED_PRODUCT',
            sourceId: fuelProd.id,
            label: fuelProd.name,
            weightPercent: 25,
            baseReferenceValue: fuelProd.firstPrice,
          },
        ],
      },
      dataPoints: {
        create: [
          { value: 100.0, recordedAt: makeDate(curYear, curMonth - 12, 15) },
          { value: 101.8, recordedAt: makeDate(curYear, curMonth - 9, 15) },
          { value: 104.2, recordedAt: makeDate(curYear, curMonth - 6, 15) },
          { value: 107.1, recordedAt: makeDate(curYear, curMonth - 3, 15) },
          { value: 111.5, recordedAt: makeDate(curYear, curMonth - 1, 15) },
          { value: 113.8, recordedAt: now },
        ],
      },
    },
  });

  await prisma.customIndex.create({
    data: {
      name: 'Indice Énergie & Abonnements',
      description: 'Suivi manuel base 100 de vos contrats fixes (électricité, fibre, mobile).',
      baseValue: 100.0,
      type: 'MANUAL',
      dataPoints: {
        create: [
          { value: 100.0, recordedAt: makeDate(curYear, curMonth - 12, 10) },
          { value: 102.4, recordedAt: makeDate(curYear, curMonth - 8, 10) },
          { value: 105.1, recordedAt: makeDate(curYear, curMonth - 6, 10) },
          { value: 106.8, recordedAt: makeDate(curYear, curMonth - 3, 10) },
          { value: 108.0, recordedAt: makeDate(curYear, curMonth - 1, 10) },
          { value: 109.2, recordedAt: now },
        ],
      },
    },
  });

  console.log(
    `✅ Seed terminé : 10 catégories, 6 charges fixes (${recElectricite.title}, ${recFibre.title}, ${recStreaming.title} à venir), ${
      historicalTxData.length + currentMonthTxData.length + prevYearTxData.length
    } transactions, 3 enveloppes patrimoniales, 5 produits suivis, 2 bilans mensuels, profil fiscal 2026 et 2 indices personnalisés.`
  );
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
