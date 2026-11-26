# BudgetZen — PWA de Gestion de Budget Personnel

Application web progressive (PWA) minimaliste inspirée du design Apple, pensée pour un usage quotidien sur **iOS (ajout à l'écran d'accueil)**, **macOS** et **Windows**.

## Architecture Modulaire

```
├── prisma/
│   ├── schema.prisma            # Modèles AccountSettings, Category, Transaction, RecurringPayment
│   └── seed.ts                  # Données de démonstration réalistes sur 5 mois
├── public/
│   ├── manifest.json            # Manifeste PWA (standalone, icônes maskable)
│   ├── sw.js                    # Service Worker (cache assets + network-first API)
│   └── icons/                   # Icônes PWA (180px iOS, 192px, 512px, SVG)
└── src/
    ├── core/                    # Logique métier pure (zéro dépendance UI / DB)
    │   ├── types.ts             # Modèles métier strictement typés
    │   ├── budget.ts            # Reste à vivre, jauge de rythme, seuils progressifs, aperçu temps réel
    │   ├── recurring.ts         # Échéancier mensuel et fenêtre glissante à 7 jours
    │   ├── optimizer.ts         # Moteur de recommandations (hausse >20%, budget/jour, rééquilibrage)
    │   ├── format.ts            # Formatage monétaire et dates (fr-FR)
    │   └── __tests__/core.test.ts
    ├── components/
    │   ├── ui/                  # Composants génériques (Button, Card, Modal, ProgressBar, Gauge, Badge, ThemeProvider)
    │   └── BudgetAppShell.tsx   # Navigation desktop/mobile, sélecteur de mois, bouton flottant (+)
    ├── features/                # Modules fonctionnels découplés
    │   ├── dashboard/           # Vue principale, Reste à vivre, alertes prioritaires
    │   ├── transactions/        # Modale de saisie rapide (<5s) avec aperçu d'impact + historique filtrable
    │   ├── categories/          # CRUD dynamique des catégories, plafonds et seuils d'alerte
    │   ├── recurring/           # Charges fixes, prélèvements sous 7 jours et validation en 1 clic
    │   └── analytics/           # Graphiques Recharts et cartes d'optimisation actionnables
    ├── lib/                     # Client Prisma & sérialiseurs serveur
    └── app/                     # Next.js App Router + API Routes REST
```

## Démarrage rapide

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

### Scripts utiles
- `npm test` : Exécute les tests unitaires Vitest du moteur `src/core/`.
- `npm run build` : Compile le build de production Next.js.
- `npm run db:reset` : Réinitialise la base SQLite locale et réinjecte le seed de démonstration.
- `npm run db:studio` : Ouvre Prisma Studio pour inspecter la base de données.

## Installer comme application native sur iPhone (iOS)
1. Déployez l'application en HTTPS (ou ouvrez-la depuis votre réseau local).
2. Ouvrez-la dans **Safari** sur iOS.
3. Appuyez sur le bouton **Partager** puis sur **« Sur l'écran d'accueil »**.
4. L'application s'ouvre ensuite en plein écran natif (`display: standalone`, `apple-mobile-web-app-capable`).

## Passage à PostgreSQL / Supabase (Synchronisation multi-appareils)
Dans `prisma/schema.prisma`, remplacez `provider = "sqlite"` par `provider = "postgresql"`, configurez `DATABASE_URL` avec votre chaîne Supabase, puis exécutez `npx prisma db push`.
