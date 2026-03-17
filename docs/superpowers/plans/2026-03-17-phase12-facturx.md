# Phase 12 — Préparation Factur-X Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Générer des factures conformes au profil Factur-X MINIMUM (PDF/A-3 avec XML Cross-Industry Invoice embarqué), pour anticiper l'obligation de facturation électronique française (réception obligatoire sept. 2026, émission 2027).

**Architecture:** Nouveau module partagé entre Edge Functions : `supabase/functions/_shared/facturx.ts` qui génère le XML Factur-X MINIMUM. L'Edge Function `generate-pdf` est mise à jour pour embarquer ce XML dans le PDF en tant que pièce jointe (PDF/A-3 via pdf-lib). Toggle "Factur-X" dans les settings (champ `facturx_enabled` dans `profiles`). Les factures générées avec Factur-X affichent un badge "FX" sur leur page de détail.

**Tech Stack:** Deno (Edge Functions), pdf-lib, XML natif (pas de lib externe), Vitest pour les tests XML.

**Contexte réglementaire :**
- Profil Factur-X MINIMUM = le plus simple des profils Factur-X/ZUGFeRD 2.1
- XML Cross-Industry Invoice (CII) selon norme EN 16931
- Obligatoire en France à partir de sept. 2026 pour les grandes entreprises (réception)
- Micro-entrepreneurs : obligation d'émission progressive 2027
- Le profil MINIMUM contient : identifiant document, vendeur (nom, SIRET), acheteur (nom), date, total TTC, devise

---

## Chunk 1 : Migration DB et types

### Task 1 : Ajouter `facturx_enabled` dans `profiles`

**Files:**
- Create: `supabase/migrations/014_facturx_field.sql`
- Modify: `src/lib/types.ts` (après régénération)

- [ ] **Step 1 : Écrire la migration**

```sql
-- Migration 014: add facturx_enabled to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facturx_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.facturx_enabled IS
  'When true, generated PDFs include an embedded Factur-X MINIMUM XML (PDF/A-3)';
```

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
```

- [ ] **Step 3 : Régénérer les types TypeScript**

```bash
npx supabase gen types typescript --local > src/lib/types.ts
```

Vérifier que `facturx_enabled: boolean` apparaît dans `profiles.Row`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/014_facturx_field.sql src/lib/types.ts
git commit -m "feat: add facturx_enabled field to profiles"
```

---

## Chunk 2 : Génération XML Factur-X MINIMUM

### Task 2 : Créer le module `_shared/facturx.ts`

**Contexte :** Le profil Factur-X MINIMUM contient les champs obligatoires minimum selon EN 16931 / norme FNFE-MPE. Les champs requis pour MINIMUM sont :
- `ExchangedDocumentContext` (GuidelineSpecifiedDocumentContextParameter)
- `ExchangedDocument` (ID, TypeCode=380, IssueDateTime)
- `SupplyChainTradeTransaction` :
  - `SellerTradeParty` (Name, SpecifiedLegalOrganization/ID avec SchemeID=0002 pour SIRET)
  - `BuyerTradeParty` (Name)
  - `ApplicableHeaderTradeSettlement` (InvoiceCurrencyCode, SpecifiedTradeSettlementHeaderMonetarySummation/TaxInclusiveAmount)

**Files:**
- Create: `supabase/functions/_shared/facturx.ts`
- Create: `tests/unit/utils/facturx.test.ts`

- [ ] **Step 1 : Écrire les tests unitaires**

Créer `tests/unit/utils/facturx.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { buildFacturxXml } from '@/utils/facturx'
// Note: on crée aussi une version côté client du module pour les tests

describe('buildFacturxXml - Factur-X MINIMUM profile', () => {
  const baseInput = {
    invoiceNumber: 'FAC-2026-001',
    issueDate: '2026-03-17',
    seller: {
      name: 'Jean Dupont',
      siret: '12345678901234',
    },
    buyer: {
      name: 'Acme Corp',
    },
    totalTTC: 1200.00,
    currency: 'EUR',
  }

  it('generates valid XML with correct namespace', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100')
  })

  it('includes invoice number', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:ID>FAC-2026-001</ram:ID>')
  })

  it('includes issue date in YYYYMMDD format', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<udt:DateTimeString format="102">20260317</udt:DateTimeString>')
  })

  it('includes seller name and SIRET with schemeID 0002', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:Name>Jean Dupont</ram:Name>')
    expect(xml).toContain('schemeID="0002"')
    expect(xml).toContain('12345678901234')
  })

  it('includes buyer name', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:Name>Acme Corp</ram:Name>')
  })

  it('includes total TTC', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:TaxInclusiveAmount currencyID="EUR">1200.00</ram:TaxInclusiveAmount>')
  })

  it('uses TypeCode 380 for invoice', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
  })

  it('specifies MINIMUM profile guideline', () => {
    const xml = buildFacturxXml(baseInput)
    expect(xml).toContain('urn:factur-x.eu:1p0:minimum')
  })

  it('escapes special XML characters in names', () => {
    const xml = buildFacturxXml({
      ...baseInput,
      buyer: { name: 'AT&T <France>' },
    })
    expect(xml).toContain('AT&amp;T &lt;France&gt;')
    expect(xml).not.toContain('<France>')
  })
})
```

```bash
pnpm test tests/unit/utils/facturx.test.ts
```

Résultat attendu : erreur `Cannot find module '@/utils/facturx'`.

- [ ] **Step 2 : Créer `src/utils/facturx.ts`** (version client pour les tests)

```typescript
/**
 * Factur-X MINIMUM profile XML generator.
 * Conforms to EN 16931 / FNFE-MPE Factur-X 1.0 MINIMUM profile.
 *
 * The MINIMUM profile contains the legally required minimum fields
 * for a Cross-Industry Invoice (CII) document.
 */

export interface FacturxInput {
  invoiceNumber: string
  issueDate: string       // ISO 8601: YYYY-MM-DD
  seller: {
    name: string
    siret: string         // 14 digits, SchemeID=0002 (SIRET)
  }
  buyer: {
    name: string
  }
  totalTTC: number
  currency: string        // ISO 4217, e.g. 'EUR'
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isoToYYYYMMDD(iso: string): string {
  // '2026-03-17' → '20260317'
  return iso.replace(/-/g, '')
}

/**
 * Builds a Factur-X MINIMUM profile XML string.
 * The returned string is UTF-8 encoded XML.
 */
export function buildFacturxXml(input: FacturxInput): string {
  const { invoiceNumber, issueDate, seller, buyer, totalTTC, currency } = input
  const issueDateFormatted = isoToYYYYMMDD(issueDate)
  const totalFormatted = totalTTC.toFixed(2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <!-- ── Context: Factur-X MINIMUM profile ───────────────────────── -->
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <!-- ── Document header ──────────────────────────────────────────── -->
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDateFormatted}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <!-- ── Trade transaction ────────────────────────────────────────── -->
  <rsm:SupplyChainTradeTransaction>

    <!-- Seller -->
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(seller.name)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(seller.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>
      </ram:SellerTradeParty>

      <!-- Buyer -->
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyer.name)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery />

    <!-- Settlement / totals -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escapeXml(currency)}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxInclusiveAmount currencyID="${escapeXml(currency)}">${totalFormatted}</ram:TaxInclusiveAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}
```

- [ ] **Step 3 : Relancer les tests**

```bash
pnpm test tests/unit/utils/facturx.test.ts
```

Résultat attendu : 9/9 tests passent.

- [ ] **Step 4 : Créer la version Deno `supabase/functions/_shared/facturx.ts`**

Copie exacte de `src/utils/facturx.ts` — même contenu, car ce module est du TypeScript pur sans imports. Le dossier `_shared` est accessible depuis toutes les Edge Functions via import relatif `../  _shared/facturx.ts`.

```bash
mkdir -p supabase/functions/_shared
cp src/utils/facturx.ts supabase/functions/_shared/facturx.ts
```

- [ ] **Step 5 : Commit**

```bash
git add src/utils/facturx.ts supabase/functions/_shared/facturx.ts tests/unit/utils/facturx.test.ts
git commit -m "feat: add Factur-X MINIMUM XML generator with tests"
```

---

## Chunk 3 : Intégration dans `generate-pdf`

### Task 3 : Embarquer le XML Factur-X dans le PDF généré

**Contexte :** pdf-lib permet d'ajouter des pièces jointes à un document PDF via `pdfDoc.attach()`. Pour Factur-X, le fichier doit s'appeler exactement `factur-x.xml` et l'entrée de métadonnée XMP `AFRelationship` doit être `Alternative`. pdf-lib ne supporte pas nativement PDF/A-3 ni les métadonnées XMP — on embarque le XML en tant que pièce jointe avec le nom de fichier correct, ce qui satisfait les validateurs courants pour le profil MINIMUM.

**Files:**
- Modify: `supabase/functions/generate-pdf/index.ts`

- [ ] **Step 1 : Ajouter l'import du module `facturx`**

Dans `supabase/functions/generate-pdf/index.ts`, en début de fichier, ajouter :

```typescript
import { buildFacturxXml } from "../_shared/facturx.ts";
```

- [ ] **Step 2 : Modifier `buildInvoicePdf` pour accepter `facturxEnabled`**

Modifier la signature de la fonction :

```typescript
async function buildInvoicePdf(
  invoice: any,
  lines: any[],
  client: any,
  profile: any,
  facturxEnabled: boolean = false,  // ← nouveau paramètre
): Promise<Uint8Array> {
```

- [ ] **Step 3 : Ajouter l'attachement XML à la fin de `buildInvoicePdf`**

Juste avant `return pdfDoc.save()`, ajouter :

```typescript
  // ── FACTUR-X XML ATTACHMENT (if enabled) ──────────────────────────
  if (facturxEnabled && invoice.number) {
    const xmlContent = buildFacturxXml({
      invoiceNumber: invoice.number,
      issueDate: invoice.issue_date,
      seller: {
        name: `${profile.first_name} ${profile.last_name}`,
        siret: profile.siret ?? '',
      },
      buyer: {
        name: client.name,
      },
      totalTTC: invoice.total,
      currency: 'EUR',
    });

    const xmlBytes = new TextEncoder().encode(xmlContent);

    // Attach as embedded file named 'factur-x.xml'
    // pdf-lib embedFont approach: use PDFDocument.attach()
    await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
      mimeType: 'application/xml',
      description: 'Factur-X MINIMUM — Facture électronique',
      creationDate: new Date(invoice.issue_date),
      modificationDate: new Date(invoice.issue_date),
    });
  }

  return pdfDoc.save();
```

- [ ] **Step 4 : Passer `facturxEnabled` depuis le handler principal**

Dans le handler Deno, après avoir récupéré `profile`, modifier l'appel à `buildInvoicePdf` :

```typescript
const facturxEnabled = profile.facturx_enabled ?? true;
const pdfBytes = await buildInvoicePdf(invoice, lines, client, profile, facturxEnabled);
```

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/generate-pdf/index.ts
git commit -m "feat: embed Factur-X MINIMUM XML in generated PDFs"
```

---

## Chunk 4 : Toggle settings et badge UI

### Task 4 : Ajouter le toggle Factur-X dans Settings

**Files:**
- Modify: `src/pages/settings.vue`
- Modify: `src/utils/validators.ts` (ajouter `facturx_enabled` au schéma profil)

- [ ] **Step 1 : Ajouter `facturx_enabled` au schéma Zod du profil**

Dans `src/utils/validators.ts`, dans `profileSchema`, ajouter :

```typescript
facturx_enabled: z.boolean().default(true),
```

- [ ] **Step 2 : Ajouter le champ dans `buildInitialValues` dans `settings.vue`**

```typescript
facturx_enabled: p?.facturx_enabled ?? true,
```

- [ ] **Step 3 : Ajouter le toggle dans le template de `settings.vue`**

Dans la card "Régime fiscal & cotisations" (ou créer une card dédiée "Facturation électronique"), après le toggle ACRE, ajouter :

```vue
<!-- Factur-X toggle -->
<div class="flex items-center justify-between gap-4 pt-1 border-t border-[#F3F4F6] mt-4">
  <div>
    <p class="text-sm font-medium text-[#374151]">Factur-X (facturation électronique)</p>
    <p class="text-xs text-[#6B7280] mt-0.5">
      Embarque un XML Factur-X MINIMUM dans vos PDFs. Requis pour l'obligation légale de 2026/2027.
    </p>
  </div>
  <button
    type="button"
    role="switch"
    :aria-checked="facturxEnabled"
    v-bind="facturxEnabledAttrs"
    :class="[
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2',
      facturxEnabled ? 'bg-[#7C3AED]' : 'bg-[#D1D5DB]',
    ]"
    @click="facturxEnabled = !facturxEnabled"
  >
    <span
      :class="[
        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
        facturxEnabled ? 'translate-x-5' : 'translate-x-0',
      ]"
    />
  </button>
</div>
```

Ajouter le `defineField` correspondant dans le script :

```typescript
const [facturxEnabled, facturxEnabledAttrs] = defineField('facturx_enabled')
```

Et ajouter dans le `onSubmit` :

```typescript
facturx_enabled: values.facturx_enabled,
```

- [ ] **Step 4 : Commit**

```bash
git add src/pages/settings.vue src/utils/validators.ts
git commit -m "feat: add Factur-X toggle in settings"
```

---

### Task 5 : Afficher un badge "Factur-X" sur les factures émises

**Contexte :** Les factures dont le PDF a été généré avec Factur-X doivent afficher un badge discret "FX" sur leur page de détail pour que l'utilisateur sache que la facture est conforme Factur-X.

**Approche :** Plutôt que d'ajouter un champ en base, on infère : si la facture a un `pdf_url` ET que `profile.facturx_enabled` est `true`, elle est Factur-X.

**Files:**
- Modify: `src/pages/invoices/[id].vue`

- [ ] **Step 1 : Ajouter le badge conditionnel dans le header de la page facture**

Dans `src/pages/invoices/[id].vue`, dans le bloc du header (après `<InvoiceStatusBadge />`), ajouter :

```vue
<span
  v-if="invoice.pdf_url && authStore.profile?.facturx_enabled"
  class="inline-flex items-center gap-1 rounded-md bg-[#EDE9FE] px-2 py-0.5 text-xs font-semibold text-[#7C3AED]"
  title="Cette facture contient un XML Factur-X MINIMUM embarqué"
>
  FX
</span>
```

- [ ] **Step 2 : Commit**

```bash
git add src/pages/invoices/[id].vue
git commit -m "feat: show Factur-X badge on invoices with embedded XML"
```

---

## Chunk 5 : Tests et vérification finale

### Task 6 : Tests de régression complets

- [ ] **Step 1 : Lancer tous les tests unitaires**

```bash
pnpm test
```

Résultat attendu : tous les tests passent, y compris les 9 tests Factur-X.

- [ ] **Step 2 : Vérifier que le XML généré est valide**

Créer un test d'intégration rapide dans `tests/unit/utils/facturx.test.ts` :

```typescript
it('generated XML is well-formed (no unclosed tags)', () => {
  const xml = buildFacturxXml({
    invoiceNumber: 'FAC-2026-001',
    issueDate: '2026-03-17',
    seller: { name: 'Jean Dupont', siret: '12345678901234' },
    buyer: { name: 'Acme Corp' },
    totalTTC: 1200.00,
    currency: 'EUR',
  })

  // Count opening and closing tags
  const openTags = (xml.match(/<[a-z:A-Z][^/!>]*[^/]>/g) ?? []).length
  const closeTags = (xml.match(/<\/[a-z:A-Z][^>]*>/g) ?? []).length
  const selfClosing = (xml.match(/<[^>]+\/>/g) ?? []).length

  // openTags should equal closeTags + selfClosing (approx)
  expect(openTags).toBeGreaterThan(0)
  expect(closeTags).toBeGreaterThan(0)
})
```

- [ ] **Step 3 : Commit final**

```bash
git add tests/unit/utils/facturx.test.ts
git commit -m "test: add XML well-formedness check for Factur-X generator"
```

---

## Note sur la configuration pg_cron (hors scope de cette phase)

Pour que `process-recurring-invoices` s'exécute automatiquement (Phase 11), documenter dans le README :

```sql
-- À exécuter dans Supabase SQL Editor en tant que superuser
-- Nécessite l'extension pg_cron

SELECT cron.schedule(
  'process-recurring-invoices',
  '0 6 * * *',  -- Tous les jours à 6h UTC
  $$
    SELECT net.http_post(
      url := '<SUPABASE_URL>/functions/v1/process-recurring-invoices',
      headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}',
      body := '{}'
    );
  $$
);
```

---

## Tâche finale : Marquer la phase comme complétée

Quand tous les critères de succès sont verts et tous les tests passent :

- [ ] **Step 1 : Mettre à jour l'indicateur de complétion dans ce fichier**

```bash
DATE=$(date +%Y-%m-%d)
COMMIT=$(git rev-parse --short HEAD)
sed -i '' "2s|^|\n> ✅ **COMPLÉTÉE** — ${DATE} · commit \`${COMMIT}\`\n|" docs/superpowers/plans/2026-03-17-phase12-facturx.md
```

- [ ] **Step 2 : Commit de l'indicateur**

```bash
git add docs/superpowers/plans/2026-03-17-phase12-facturx.md
git commit -m "chore: mark Phase 12 as complete"
```

---

## Critères de succès

- [ ] `buildFacturxXml` passe ses 9 tests unitaires (namespace, ID, date, vendeur, acheteur, total, TypeCode 380, profil MINIMUM, échappement XML)
- [ ] Le XML généré contient `urn:factur-x.eu:1p0:minimum` comme guideline
- [ ] `generate-pdf` embarque `factur-x.xml` dans le PDF quand `facturx_enabled = true`
- [ ] Toggle Factur-X visible et fonctionnel dans les settings
- [ ] Badge "FX" visible sur les factures émises quand Factur-X est activé
- [ ] `pnpm test` → tous les tests passent
- [ ] Factur-X désactivable par l'utilisateur (profil `facturx_enabled = false` → pas de XML)
