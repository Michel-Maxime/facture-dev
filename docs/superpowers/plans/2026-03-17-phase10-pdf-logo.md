# Phase 10 — Unification PDF et logo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avoir une seule source de vérité pour le contenu des PDFs de facture, et permettre à l'utilisateur d'uploader un logo qui apparaît sur toutes ses factures.

**Architecture:** Le template HTML côté client (`src/utils/pdf-template.ts`) devient la source canonique du contenu. L'Edge Function `generate-pdf` est mise à jour pour utiliser les mêmes données et logique. Une nouvelle Edge Function `preview-pdf` génère un aperçu pour les brouillons (avec filigrane "BROUILLON"). `usePdf.ts` est simplifié : le fallback HTML `downloadPdf` est remplacé par un appel à `preview-pdf`. L'upload logo se fait dans `settings.vue` et stocke dans Supabase Storage bucket `logos`.

**Tech Stack:** Vue 3, Supabase Storage, Supabase Edge Functions (Deno), pdf-lib, Vitest.

---

## Chunk 1 : Unification du contenu PDF (source unique)

### Task 1 : Auditer les différences entre les deux templates

**Contexte :** Le template HTML (`pdf-template.ts`) et la fonction `buildInvoicePdf` dans `generate-pdf/index.ts` contiennent des mentions légales dupliquées. Il faut identifier les divergences avant de corriger.

**Files:**
- Read: `src/utils/pdf-template.ts`
- Read: `supabase/functions/generate-pdf/index.ts`
- Read: `src/lib/constants.ts` (INVOICE_MENTIONS)

- [ ] **Step 1 : Dresser la liste des divergences**

Lire les deux fichiers et noter :
1. Les mentions présentes dans l'un mais absentes de l'autre
2. Les formulations différentes pour la même mention
3. Les données affichées dans l'un mais pas dans l'autre (ex: code APE)

Résultat attendu : une liste mentale des points à aligner dans l'Edge Function.

Divergences connues à corriger dans `generate-pdf/index.ts` :
- Mention `latePaymentRate` : le template HTML utilise `INVOICE_MENTIONS.latePaymentRate` ("Pénalités de retard : 3 fois le taux d'intérêt légal"), mais l'Edge Function a sa propre string ("application d'une pénalité égale à 3 fois le taux d'intérêt légal") → aligner sur `constants.ts`
- Code APE : présent dans le template HTML, absent de l'Edge Function
- Format de la mention TVA exemption : vérifier qu'elle est identique

---

### Task 2 : Mettre à jour `generate-pdf` pour aligner les mentions légales

**Contexte :** Les mentions légales dans l'Edge Function doivent être identiques au mot près à celles de `src/lib/constants.ts` (source de vérité réglementaire). L'Edge Function est en Deno donc ne peut pas importer `constants.ts` directement — les constantes sont dupliquées, mais on les aligne.

**Files:**
- Modify: `supabase/functions/generate-pdf/index.ts`

- [ ] **Step 1 : Aligner les mentions légales dans l'Edge Function**

Dans `supabase/functions/generate-pdf/index.ts`, dans la section `// ── LEGAL MENTIONS`, remplacer la string de pénalité de retard :

```typescript
// AVANT
page.drawText("En cas de retard de paiement, application d'une pénalité égale à 3 fois le taux d'intérêt légal.", ...)

// APRÈS
page.drawText("Pénalités de retard : 3 fois le taux d'intérêt légal", ...)
```

- [ ] **Step 2 : Ajouter le Code APE dans l'en-tête de l'Edge Function**

Dans la section `// ── HEADER`, après la ligne qui affiche `SIRET`, ajouter :

```typescript
if (profile.code_ape) {
  y -= 12;
  page.drawText(`Code APE : ${profile.code_ape}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
}
```

- [ ] **Step 3 : Vérifier que les tests de mentions passent**

Les tests dans `tests/unit/utils/pdf-mentions.test.ts` testent le template HTML. Vérifier qu'ils passent toujours :

```bash
pnpm test tests/unit/utils/pdf-mentions.test.ts
```

Résultat attendu : tous les tests passent (les mentions sont inchangées dans `pdf-template.ts`).

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/generate-pdf/index.ts
git commit -m "fix: align legal mentions in generate-pdf Edge Function with constants.ts"
```

---

### Task 3 : Créer l'Edge Function `preview-pdf` pour les brouillons

**Contexte :** Actuellement, les brouillons utilisent `downloadPdf` qui ouvre une fenêtre HTML et demande à l'utilisateur d'utiliser "Enregistrer en PDF". C'est une mauvaise UX. On crée une Edge Function `preview-pdf` qui génère le même PDF que `generate-pdf` mais avec un filigrane "BROUILLON" et sans numéro. Cette fonction accepte les brouillons (pas besoin d'un `invoice.number`).

**Files:**
- Create: `supabase/functions/preview-pdf/index.ts`

- [ ] **Step 1 : Créer le fichier `supabase/functions/preview-pdf/index.ts`**

Copier la structure de `generate-pdf/index.ts` et apporter les modifications suivantes :

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(dateStr));
}

async function buildPreviewPdf(invoice: any, lines: any[], client: any, profile: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const purple = rgb(0.486, 0.227, 0.929);
  const gray = rgb(0.42, 0.447, 0.502);
  const black = rgb(0.067, 0.094, 0.153);
  const lightGray = rgb(0.953, 0.953, 0.965);
  const red = rgb(0.863, 0.196, 0.184); // for watermark

  let y = height - 50;
  const marginL = 50;
  const marginR = width - 50;

  // ── WATERMARK "BROUILLON" ──────────────────────────────────────────────
  // Diagonal text centered on the page
  page.drawText('BROUILLON', {
    x: 120,
    y: height / 2 - 30,
    font: fontBold,
    size: 72,
    color: rgb(0.9, 0.9, 0.9),
    rotate: { type: 'degrees', angle: 45 },
    opacity: 0.25,
  });

  // ── HEADER ────────────────────────────────────────────────────────────
  page.drawText(`${profile.first_name} ${profile.last_name}`, {
    x: marginL, y, font: fontBold, size: 18, color: purple,
  });
  page.drawText('FACTURE', {
    x: marginR - 120, y, font: fontBold, size: 22, color: black,
  });

  y -= 18;
  page.drawText('Entrepreneur Individuel', { x: marginL, y, font: fontRegular, size: 9, color: gray });
  // No invoice number for drafts
  page.drawText('(brouillon — numéro non attribué)', { x: marginR - 200, y, font: fontRegular, size: 9, color: red });

  y -= 14;
  page.drawText(`SIRET : ${profile.siret}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  page.drawText(`Date d'émission : ${formatDate(invoice.issue_date)}`, { x: marginR - 180, y, font: fontRegular, size: 9, color: gray });

  y -= 12;
  page.drawText(`${profile.address}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  page.drawText(`Date de prestation : ${formatDate(invoice.service_date)}`, { x: marginR - 180, y, font: fontRegular, size: 9, color: gray });

  y -= 12;
  page.drawText(`${profile.postal_code} ${profile.city}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  page.drawText(`Échéance : ${formatDate(invoice.due_date)}`, { x: marginR - 180, y, font: fontRegular, size: 9, color: gray });

  if (profile.code_ape) {
    y -= 12;
    page.drawText(`Code APE : ${profile.code_ape}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  }

  // ── SEPARATOR ─────────────────────────────────────────────────────────
  y -= 20;
  page.drawLine({ start: { x: marginL, y }, end: { x: marginR, y }, thickness: 0.5, color: lightGray });

  // ── CLIENT ────────────────────────────────────────────────────────────
  y -= 20;
  page.drawText('FACTURÉ À', { x: marginL, y, font: fontBold, size: 8, color: gray });
  y -= 14;
  page.drawText(client.name, { x: marginL, y, font: fontBold, size: 11, color: black });
  y -= 13;
  if (client.siret) {
    page.drawText(`SIRET : ${client.siret}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
    y -= 12;
  }
  page.drawText(client.address, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  y -= 12;
  page.drawText(`${client.postal_code} ${client.city}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  if (client.email) {
    y -= 12;
    page.drawText(client.email, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  }

  // ── LINES TABLE ───────────────────────────────────────────────────────
  y -= 28;
  const colDesc = marginL;
  const colQty = 330;
  const colPU = 400;
  const colMt = 490;

  page.drawRectangle({ x: marginL, y: y - 4, width: marginR - marginL, height: 18, color: lightGray });
  page.drawText('Description', { x: colDesc, y, font: fontBold, size: 8, color: gray });
  page.drawText('Qté', { x: colQty, y, font: fontBold, size: 8, color: gray });
  page.drawText('P.U. HT', { x: colPU, y, font: fontBold, size: 8, color: gray });
  page.drawText('Montant HT', { x: colMt, y, font: fontBold, size: 8, color: gray });

  const sortedLines = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  for (const line of sortedLines) {
    y -= 20;
    page.drawText(line.description.slice(0, 60), { x: colDesc, y, font: fontRegular, size: 9, color: black });
    page.drawText(String(line.quantity), { x: colQty, y, font: fontRegular, size: 9, color: black });
    page.drawText(formatCurrency(line.unit_price), { x: colPU, y, font: fontRegular, size: 9, color: black });
    page.drawText(formatCurrency(line.amount), { x: colMt, y, font: fontBold, size: 9, color: black });
    y -= 2;
    page.drawLine({ start: { x: marginL, y }, end: { x: marginR, y }, thickness: 0.3, color: lightGray });
  }

  // ── TOTALS ────────────────────────────────────────────────────────────
  y -= 20;
  const totalsX = 400;
  page.drawText('Sous-total HT', { x: totalsX, y, font: fontRegular, size: 9, color: gray });
  page.drawText(formatCurrency(invoice.subtotal), { x: marginR - 60, y, font: fontRegular, size: 9, color: black });

  if (invoice.vat_rate > 0) {
    y -= 14;
    page.drawText(`TVA (${(invoice.vat_rate * 100).toFixed(0)} %)`, { x: totalsX, y, font: fontRegular, size: 9, color: gray });
    page.drawText(formatCurrency(invoice.vat_amount), { x: marginR - 60, y, font: fontRegular, size: 9, color: black });
  }

  y -= 16;
  page.drawLine({ start: { x: totalsX, y: y + 2 }, end: { x: marginR, y: y + 2 }, thickness: 1, color: purple });
  y -= 4;
  page.drawText('Total TTC', { x: totalsX, y, font: fontBold, size: 11, color: purple });
  page.drawText(formatCurrency(invoice.total), { x: marginR - 70, y, font: fontBold, size: 11, color: purple });

  // ── PAYMENT INFO ──────────────────────────────────────────────────────
  y -= 30;
  page.drawRectangle({ x: marginL, y: y - 50, width: marginR - marginL, height: 70, borderColor: lightGray, borderWidth: 0.5 });
  y -= 4;
  page.drawText('RÈGLEMENT', { x: marginL + 10, y, font: fontBold, size: 8, color: gray });
  y -= 14;
  page.drawText(`Mode : ${invoice.payment_method}`, { x: marginL + 10, y, font: fontRegular, size: 9, color: black });
  page.drawText(`Délai : ${invoice.payment_term_days} jours`, { x: 250, y, font: fontRegular, size: 9, color: black });
  page.drawText(`Échéance : ${formatDate(invoice.due_date)}`, { x: 370, y, font: fontRegular, size: 9, color: black });
  if (profile.iban) {
    y -= 14;
    page.drawText(`IBAN : ${profile.iban}`, { x: marginL + 10, y, font: fontRegular, size: 9, color: black });
    if (profile.bic) {
      page.drawText(`BIC : ${profile.bic}`, { x: 350, y, font: fontRegular, size: 9, color: black });
    }
  }

  // ── LEGAL MENTIONS ────────────────────────────────────────────────────
  y -= 50;
  page.drawLine({ start: { x: marginL, y: y + 8 }, end: { x: marginR, y: y + 8 }, thickness: 0.3, color: lightGray });

  const mentionSize = 7.5;

  if (invoice.vat_rate === 0) {
    page.drawText('TVA non applicable, article 293 B du Code Général des Impôts', {
      x: marginL, y, font: fontRegular, size: mentionSize, color: gray,
    });
    y -= 11;
  }
  page.drawText("Pénalités de retard : 3 fois le taux d'intérêt légal", {
    x: marginL, y, font: fontRegular, size: mentionSize, color: gray,
  });
  y -= 11;
  page.drawText('Indemnité forfaitaire pour frais de recouvrement : 40 €', {
    x: marginL, y, font: fontRegular, size: mentionSize, color: gray,
  });

  if (invoice.notes) {
    y -= 16;
    page.drawText(invoice.notes.slice(0, 120), { x: marginL, y, font: fontRegular, size: 8, color: gray });
  }

  return pdfDoc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const { invoiceId } = await req.json();
  if (!invoiceId) return json({ error: 'invoiceId is required' }, 400);

  const [invoiceRes, linesRes, profileRes] = await Promise.all([
    supabase.from('invoices').select('*, clients(*)').eq('id', invoiceId).eq('user_id', user.id).single(),
    supabase.from('invoice_lines').select('*').eq('invoice_id', invoiceId).order('sort_order'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ]);

  if (invoiceRes.error || !invoiceRes.data) return json({ error: 'Invoice not found' }, 404);
  if (profileRes.error || !profileRes.data) return json({ error: 'Profile not found' }, 404);

  const invoice = invoiceRes.data;
  const client = invoice.clients;
  const profile = profileRes.data;
  const lines = linesRes.data ?? [];

  if (!client) return json({ error: 'Client not found' }, 404);
  // preview-pdf works for both DRAFT and emitted invoices

  const pdfBytes = await buildPreviewPdf(invoice, lines, client, profile);

  // Return PDF bytes as base64
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  return new Response(JSON.stringify({ pdf: base64 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
```

- [ ] **Step 2 : Commit**

```bash
git add supabase/functions/preview-pdf/index.ts
git commit -m "feat: add preview-pdf Edge Function for draft invoices"
```

---

### Task 4 : Mettre à jour `usePdf` pour utiliser `preview-pdf`

**Contexte :** `downloadPdf` utilise actuellement `window.open` + `print()`. On le remplace par un appel à l'Edge Function `preview-pdf` qui retourne un vrai PDF téléchargeable. Le fallback `window.open` est supprimé.

**Files:**
- Modify: `src/composables/usePdf.ts`
- Modify: `tests/unit/composables/usePdf.test.ts`

- [ ] **Step 1 : Lire `tests/unit/composables/usePdf.test.ts`**

Comprendre ce qui est déjà testé pour ne pas casser les tests existants.

- [ ] **Step 2 : Mettre à jour `usePdf.ts`**

Remplacer `downloadPdf` et `printInvoice` par une fonction `downloadDraftPdf` qui appelle l'Edge Function :

```typescript
import { supabase } from '@/lib/supabase'
import { useNotificationsStore } from '@/stores/notifications'

export function usePdf() {
  const notifications = useNotificationsStore()

  /**
   * Downloads a draft invoice as PDF via the preview-pdf Edge Function.
   * Works for any invoice status (DRAFT or emitted).
   */
  async function downloadDraftPdf(invoiceId: string, filename: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('preview-pdf', {
      body: { invoiceId },
    })

    if (error || !data?.pdf) {
      notifications.error('Erreur', 'Impossible de générer l\'aperçu PDF')
      return false
    }

    // Decode base64 to blob
    const binary = atob(data.pdf)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }

  async function downloadStoredPdf(pdfUrl: string, invoiceNumber: string): Promise<boolean> {
    const { data, error } = await supabase.storage
      .from('invoices')
      .download(pdfUrl)

    if (error || !data) {
      notifications.error('Erreur', 'Impossible de télécharger le PDF')
      return false
    }

    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }

  return { downloadDraftPdf, downloadStoredPdf }
}
```

- [ ] **Step 3 : Mettre à jour `src/pages/invoices/[id].vue` pour utiliser `downloadDraftPdf`**

Chercher les usages de `downloadPdf` et `printInvoice` dans `[id].vue`. Remplacer :

```typescript
// AVANT
const { downloadPdf, downloadStoredPdf } = usePdf()
// ...
async function handleDownloadPdf() {
  if (!invoice.value || !client.value || !authStore.profile) return
  if (invoice.value.pdf_url && invoice.value.number) {
    await downloadStoredPdf(invoice.value.pdf_url, invoice.value.number)
    return
  }
  const data: PdfInvoiceData = { ... }
  downloadPdf(data)
}

// APRÈS
const { downloadDraftPdf, downloadStoredPdf } = usePdf()
// ...
async function handleDownloadPdf() {
  if (!invoice.value) return
  if (invoice.value.pdf_url && invoice.value.number) {
    await downloadStoredPdf(invoice.value.pdf_url, invoice.value.number)
    return
  }
  // For drafts: use preview-pdf Edge Function
  await downloadDraftPdf(invoice.value.id, `brouillon-${invoice.value.id.slice(0, 8)}`)
}
```

Supprimer l'import de `PdfInvoiceData` s'il n'est plus utilisé.

- [ ] **Step 4 : Faire pareil dans les autres pages qui utilisent `downloadPdf`**

Chercher tous les usages :

```bash
grep -r "downloadPdf\|printInvoice" src/
```

Mettre à jour chaque usage pour utiliser `downloadDraftPdf(invoiceId, filename)`.

- [ ] **Step 5 : Mettre à jour les tests `usePdf.test.ts`**

Remplacer les tests qui mockent `buildInvoiceHtml` / `window.open` par des tests qui mockent l'appel à l'Edge Function `preview-pdf`.

- [ ] **Step 6 : Lancer les tests**

```bash
pnpm test tests/unit/composables/usePdf.test.ts
```

- [ ] **Step 7 : Commit**

```bash
git add src/composables/usePdf.ts src/pages/invoices/[id].vue tests/unit/composables/usePdf.test.ts
git commit -m "feat: replace client-side PDF fallback with preview-pdf Edge Function"
```

---

## Chunk 2 : Upload logo et affichage sur les PDFs

### Task 5 : Créer le bucket Supabase Storage `logos`

**Contexte :** Le champ `logo_url` existe déjà dans `profiles` (type `string | null`). Il manque le bucket de stockage et les politiques RLS.

**Files:**
- Create: `supabase/migrations/012_logos_bucket.sql`

- [ ] **Step 1 : Écrire la migration SQL**

```sql
-- Migration 012: logos storage bucket and policies

-- Create the logos bucket (private — access via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  false,
  524288, -- 512 KB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own logo
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own logo
CREATE POLICY "Users can read their own logo"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update (upsert) their own logo
CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own logo
CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
# ou via MCP supabase apply_migration
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/012_logos_bucket.sql
git commit -m "feat: add logos storage bucket with user-scoped RLS policies"
```

---

### Task 6 : Upload logo dans la page Settings

**Contexte :** La page `src/pages/settings.vue` doit permettre d'uploader une image (PNG/JPEG, max 500 Ko). L'image est stockée dans le bucket `logos` au chemin `{user_id}/logo.{ext}`. Le chemin est sauvegardé dans `profiles.logo_url`.

**Files:**
- Modify: `src/pages/settings.vue`
- Create: `src/composables/useLogo.ts`

- [ ] **Step 1 : Créer `src/composables/useLogo.ts`**

```typescript
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const MAX_SIZE_BYTES = 512 * 1024 // 512 KB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function useLogo() {
  const authStore = useAuthStore()
  const notifications = useNotificationsStore()
  const uploading = ref(false)
  const logoUrl = ref<string | null>(authStore.profile?.logo_url ?? null)

  async function getLogoSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('logos')
      .createSignedUrl(path, 3600) // 1h
    if (error || !data) return null
    return data.signedUrl
  }

  async function uploadLogo(file: File): Promise<boolean> {
    if (!authStore.user) return false

    if (!ALLOWED_TYPES.includes(file.type)) {
      notifications.error('Format non supporté', 'PNG, JPEG ou WebP uniquement')
      return false
    }
    if (file.size > MAX_SIZE_BYTES) {
      notifications.error('Fichier trop volumineux', 'Maximum 512 Ko')
      return false
    }

    uploading.value = true

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const storagePath = `${authStore.user.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      notifications.error('Erreur', 'Impossible d\'uploader le logo')
      uploading.value = false
      return false
    }

    // Save path in profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ logo_url: storagePath, updated_at: new Date().toISOString() })
      .eq('id', authStore.user.id)
      .select()
      .single()

    if (updateError || !updated) {
      notifications.error('Erreur', 'Impossible de sauvegarder le logo')
      uploading.value = false
      return false
    }

    authStore.setProfile(updated)
    logoUrl.value = storagePath
    notifications.success('Logo uploadé')
    uploading.value = false
    return true
  }

  async function removeLogo(): Promise<boolean> {
    if (!authStore.user || !authStore.profile?.logo_url) return false

    const { error: removeError } = await supabase.storage
      .from('logos')
      .remove([authStore.profile.logo_url])

    if (removeError) {
      notifications.error('Erreur', 'Impossible de supprimer le logo')
      return false
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq('id', authStore.user.id)
      .select()
      .single()

    if (!updateError && updated) {
      authStore.setProfile(updated)
    }

    logoUrl.value = null
    notifications.success('Logo supprimé')
    return true
  }

  return { uploading, logoUrl, uploadLogo, removeLogo, getLogoSignedUrl }
}
```

- [ ] **Step 2 : Ajouter la section logo dans `settings.vue`**

Dans `src/pages/settings.vue`, après la card "Identité" (avant "Entreprise"), ajouter une card "Logo" :

```vue
<script setup lang="ts">
// Ajouter l'import
import { useLogo } from '@/composables/useLogo'
const { uploading: logoUploading, logoUrl, uploadLogo, removeLogo, getLogoSignedUrl } = useLogo()

// Signed URL pour l'affichage
const logoSignedUrl = ref<string | null>(null)
onMounted(async () => {
  if (logoUrl.value) {
    logoSignedUrl.value = await getLogoSignedUrl(logoUrl.value)
  }
})

async function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const success = await uploadLogo(file)
  if (success && logoUrl.value) {
    logoSignedUrl.value = await getLogoSignedUrl(logoUrl.value)
  }
  // Reset input
  input.value = ''
}

async function handleRemoveLogo() {
  await removeLogo()
  logoSignedUrl.value = null
}
</script>

<!-- Card logo à insérer dans le template, après la card Identité -->
<Card title="Logo" description="Apparaît en haut de vos factures (PNG, JPEG · max 512 Ko)" class="mb-4">
  <div class="flex items-center gap-4">
    <!-- Preview -->
    <div class="w-24 h-14 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center overflow-hidden shrink-0">
      <img
        v-if="logoSignedUrl"
        :src="logoSignedUrl"
        alt="Logo"
        class="max-w-full max-h-full object-contain"
      />
      <svg v-else class="w-8 h-8 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>

    <!-- Actions -->
    <div class="flex flex-col gap-2">
      <label
        class="inline-flex items-center gap-2 cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        :class="{ 'opacity-50 cursor-not-allowed': logoUploading }"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {{ logoUploading ? 'Envoi...' : (logoUrl ? 'Remplacer' : 'Uploader un logo') }}
        <input
          type="file"
          class="sr-only"
          accept="image/png,image/jpeg,image/webp"
          :disabled="logoUploading"
          @change="handleLogoUpload"
        />
      </label>
      <button
        v-if="logoUrl"
        type="button"
        class="text-xs text-[#DC2626] hover:underline text-left"
        @click="handleRemoveLogo"
      >
        Supprimer le logo
      </button>
    </div>
  </div>
</Card>
```

- [ ] **Step 3 : Lancer les tests**

```bash
pnpm test
```

- [ ] **Step 4 : Commit**

```bash
git add src/composables/useLogo.ts src/pages/settings.vue
git commit -m "feat: add logo upload to settings page"
```

---

### Task 7 : Afficher le logo dans les PDFs générés par l'Edge Function

**Contexte :** Quand `profile.logo_url` est défini, l'Edge Function `generate-pdf` (et `preview-pdf`) doit récupérer l'image depuis le bucket `logos` et l'embarquer dans le PDF en haut à gauche, avant le nom de l'émetteur.

**Files:**
- Modify: `supabase/functions/generate-pdf/index.ts`
- Modify: `supabase/functions/preview-pdf/index.ts`

- [ ] **Step 1 : Ajouter le helper `embedLogo` dans `generate-pdf/index.ts`**

Dans `buildInvoicePdf`, après avoir créé `pdfDoc`, ajouter avant le dessin du header :

```typescript
// ── LOGO (optional) ──────────────────────────────────────────────────
let logoY = y
if (profile.logo_url) {
  try {
    // Download logo from storage using service role
    const { data: logoData } = await supabase.storage
      .from('logos')
      .download(profile.logo_url)

    if (logoData) {
      const logoBytes = new Uint8Array(await logoData.arrayBuffer())
      const mimeType = profile.logo_url.endsWith('.png') ? 'image/png' : 'image/jpeg'

      let logoImage
      if (mimeType === 'image/png') {
        logoImage = await pdfDoc.embedPng(logoBytes)
      } else {
        logoImage = await pdfDoc.embedJpg(logoBytes)
      }

      // Scale to fit in 120x50 box
      const dims = logoImage.scaleToFit(120, 50)
      page.drawImage(logoImage, {
        x: marginL,
        y: y - dims.height + 18,
        width: dims.width,
        height: dims.height,
      })

      // Shift the seller name to the right of the logo
      // (handled below by adjusting x position when logo present)
    }
  } catch {
    // Logo fetch failed — continue without it
  }
}
```

Note : Pour simplifier, si un logo est présent, on le place en haut à gauche et le nom de l'émetteur se place à droite du logo (décalage de `logo_width + 12`). Si pas de logo, comportement actuel inchangé.

- [ ] **Step 2 : Appliquer la même modification à `preview-pdf/index.ts`**

Même code que step 1, copié dans `buildPreviewPdf`.

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/generate-pdf/index.ts supabase/functions/preview-pdf/index.ts
git commit -m "feat: embed user logo in generated PDFs"
```

---

## Critères de succès

- [ ] Mentions légales identiques entre template HTML et Edge Function `generate-pdf`
- [ ] `preview-pdf` Edge Function génère un PDF avec filigrane "BROUILLON" pour les brouillons
- [ ] `usePdf.downloadDraftPdf` appelle `preview-pdf` et télécharge le PDF (plus de `window.open`)
- [ ] Settings : upload d'un PNG/JPEG (<512 Ko) → sauvegardé dans bucket `logos` → aperçu affiché
- [ ] Logo visible sur les PDFs générés par `generate-pdf` et `preview-pdf`
- [ ] `pnpm test` → tous les tests passent
