# Analyse Produit facture.dev — Mars 2026

> Rapport généré le 2026-03-21 à partir d'une analyse multi-agents avec données web réelles.
> Sources : service-public.fr, urssaf.fr, fnfe-mpe.org, Trustpilot, forums Reddit/WebRankInfo, sites concurrents.

---

## 1. Statut des constantes légales 2026

| Paramètre | Valeur dans le code | Réalité légale 2026 | Statut |
|---|---|---|---|
| Seuil micro-BNC (services) | 83 600 € | 83 600 € (revalorisation triennale jan 2026) | ✅ Correct |
| Seuil BIC vente | 203 100 € | 203 100 € | ✅ Correct |
| TVA franchise services | 37 500 € | 37 500 € (tolérance 41 250 €) | ✅ Correct |
| Cotisations BNC-SSI | 25.60% | 25.60% (+1pt depuis jan 2026) | ✅ Correct |
| Cotisations BNC-CIPAV | 23.20% | 23.20% | ✅ Correct |
| CFP professions libérales | 0.20% | 0.20% | ✅ Correct |
| VFL BNC | 2.20% | 2.20% | ✅ Correct |
| ACRE taux (créations avant juil 2026) | 50% | 50% | ✅ Correct |
| **ACRE taux (créations après juil 2026)** | **50% (FIXE)** | **25% et conditionnel** | ❌ **BUG** |
| Factur-X profil | MINIMUM | MINIMUM insuffisant pour transmission PA | ⚠️ **Libellé trompeur** |

---

## 2. Points forts — Avantages concurrentiels réels

| Avantage | Niveau | Aucun concurrent ne fait ça |
|---|---|---|
| **Self-hosted** | UNIQUE sur le marché FR | Freebe, Indy, Abby, Pennylane sont tous SaaS fermés |
| **Immutabilité RLS niveau base de données** | SUPÉRIEUR | Les concurrents font ça en JavaScript côté applicatif |
| **Numérotation atomique PostgreSQL** | PLUS ROBUSTE | Les concurrents calculent le numéro en JS avec race conditions possibles |
| **Proratisation seuil 1ère année** | MEILLEUR | Absent ou incorrect chez les concurrents |
| **ACRE avec trimestres complets (avant juil 2026)** | RARE | Les concurrents approximent (12 mois glissants) |
| **Factur-X embarqué (MINIMUM)** | PIONNIER self-hosted | Aucun outil self-hosted ne le fait |
| **Audit log immutable INSERT ONLY** | SUPÉRIEUR | Non enforced en DB chez les concurrents |

---

## 3. Analyse concurrentielle (données réelles mars 2026)

### Pricing comparatif

| Outil | Gratuit | Entry | Mid | Top | Note Trustpilot |
|---|---|---|---|---|---|
| **Freebe** | Non (30j essai) | 15 € TTC/mois | 40 €/trim | 150 €/an | 3.7/5 (13 avis) |
| **Indy** | Oui (Essentiel) | 9 € HT/mois | 12 € HT/mois | 22-49 € HT/mois | 4.8/5 (12 420 avis) ⭐ |
| **Abby** | Oui (avec logo) | 11 € HT/mois | 19 € HT/mois | 39 € HT/mois | 4.5/5 (248 avis) |
| **Pennylane** | Non (15j essai) | 14 € HT/mois | 24 € HT/mois | 49-298 €/mois | 4.4/5 (654 avis) |
| **Henrri** | Oui (limité) | 12-13 €/mois | 20-35 €/mois | – | Lenteurs chroniques |
| **Tiime** | Oui (illimité) | 17.99 € HT/mois | 29.99 €/mois | 49.99 €/mois | PA agréée |
| **facture.dev** | Self-hosted | 0 € (hébergement propre) | – | – | UNIQUE |

### Matrice des fonctionnalités

| Feature | Freebe | Indy | Abby | Pennylane | Tiime | facture.dev |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Devis & factures illimités | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Avoirs | ✓ | ✓ | partiel | ✓ | ✓ | ✓ |
| Factures récurrentes | ✓ | – | ✓ | ✓ | – | ✓ |
| Mentions légales FR complètes | ✓ | ✓ | ✓ | partiel | ✓ | ✓ |
| Proratisation seuil 1ère année | ~approx | ~approx | – | – | – | ✓ exact |
| ACRE précis | approx | approx | – | – | – | ✓ exact |
| Immutabilité factures | JS | JS | JS | JS | JS | ✓ RLS DB |
| **Relances automatiques** | ✓ | – | ✓ | ✓ | ✓ | ❌ |
| **Widget URSSAF déclaration** | ✓ | ✓ | ✓ | – | – | ❌ |
| **Flux acompte → solde** | partiel | – | – | – | – | ❌ |
| Synchronisation bancaire | ✓ | ✓ | Pro+ | ✓ | ✓ | ❌ (incompatible self-hosted) |
| Paiement en ligne | ✓ | – | ✓ | ✓ | ✓ | ❌ |
| Signature électronique devis | – | – | ✓ (Yousign) | – | – | ❌ |
| QR code SEPA PDF | – | – | – | – | – | ❌ (opportunité) |
| Factur-X embarqué | – | EN 16931 (PA) | en cours | EN 16931 (PA) | EN 16931 (PA) | MINIMUM seulement |
| **Plateforme Agréée** | partenaire | ✓ PA agréée | en cours | ✓ PA agréée | ✓ PA agréée | ❌ (à planifier) |
| App mobile | ✓ | ✓ | – | ✓ | ✓ | ❌ (PWA) |
| Self-hosted | – | – | – | – | – | ✓ UNIQUE |
| Export FEC | – | ✓ | – | ✓ | – | ❌ |

### Bugs documentés chez les concurrents (opportunité)

**Abby (4.5/5 Trustpilot — biais de notation signalé) :**
- RIB d'un tiers envoyé au mauvais client (incident de sécurité grave)
- Calculs TVA erronés sur plusieurs mois consécutifs (août-oct 2025)
- Adresses client qui disparaissent, codes postaux effacés

**Henrri :**
- Lenteurs bloquantes hebdomadaires : *"c'est bloquant dans la journée, avec des coupures au moins une fois par semaine"* (Quentin, LeBonLogiciel, oct 2024)
- 8% d'avis 1 étoile sur Trustpilot

---

## 4. Événements de marché

### myAE.fr — Fermeture le 30 janvier 2025

myAE.fr, créé en 2009, comptait **138 000 utilisateurs actifs**. Raison officielle de fermeture :

> *"La réforme de la facturation électronique qui arrive signe l'arrêt des logiciels de facturation gratuits."* — myAE.fr, 21 janvier 2025

Conséquence : des milliers d'utilisateurs déplacés vers Evoliz (payant, même éditeur) ou en recherche d'alternative. Une fraction significative a migré vers Abby ou Henrri et rencontre maintenant des bugs ou des lenteurs. **La fenêtre de re-migration est ouverte.**

### Réforme facturation électronique — Calendrier officiel

| Date | Obligation | Concerne facture.dev |
|---|---|---|
| **1er sept 2026** | Toutes les entreprises doivent **recevoir** via une PA | Oui — utilisateurs doivent choisir une PA |
| **1er sept 2027** | PME/TPE/ME doivent **émettre** via une PA | Oui — ME B2B concernées |

**106 Plateformes Agréées immatriculées** au 10 février 2026 (dont Indy, Pennylane, Tiime, Docaposte/SERES, Dougs, Sellsy).

**Enquête CNOEC sept 2025 :** moins d'un tiers des entreprises savent quelle PA choisir. La réforme est vécue comme anxiogène : *"C'est très flou comme loi... comme toujours !"* (forum WebRankInfo).

### ACRE — Réforme au 1er juillet 2026 (LSFSS 2026)

| Aspect | Avant juil 2026 | Après juil 2026 |
|---|---|---|
| Accès | Automatique pour tous | Uniquement certains publics |
| Publics éligibles | Tous les créateurs | Demandeurs d'emploi, RSA, -26 ans, zones QPV/ZRR, etc. |
| Taux de réduction | **50%** | **25%** |
| Durée | 12 mois | 12 mois |
| Délai de demande | Non défini | 60 jours après déclaration |

---

## 5. Pain points utilisateurs (sources forums, Trustpilot, mars 2026)

| Rang | Frustration | Fréquence | Intensité | Citée par |
|---|---|---|---|---|
| #1 | Fin du gratuit / pression tarifaire (trauma myAE) | Très élevée | Très élevée | Forums AE, Reddit |
| #2 | Réforme 2026 anxiogène et floue | Très élevée | Élevée | WebRankInfo, CNOEC |
| #3 | Impayés sans relance automatique | Très élevée | Très élevée | Sogexia, forums |
| #4 | Numérotation séquentielle = anxiété amende 75k€ | Modérée | Très élevée | BonjourAutoEntrepreneur |
| #5 | Confusion CA encaissé vs facturé pour URSSAF | Fréquente | Élevée | Forums CommentCaMarche |
| #6 | Flux acompte/solde mal géré | Fréquente | Élevée | Avis Abby, forums |
| #7 | Bugs / lenteurs logiciels | Fréquente | Élevée | Trustpilot Henrri/Abby |
| #8 | Absence app mobile | Modérée | Modérée | Comparatifs |
| #9 | Fragmentation des outils (URSSAF + banque + factures) | Modérée | Modérée | Superindep testimonials |
| #10 | Migration douloureuse entre outils | Modérée | Élevée | Forums post-myAE |

---

## 6. Obligations légales à venir — Gaps facture.dev

### Factur-X : profils et conformité

| Profil | Contenu | Accepté pour transmission PA |
|---|---|---|
| **MINIMUM** (actuellement implémenté) | En-tête seulement (identification parties, montant total) | ❌ Insuffisant |
| **BASIC WL** | En-tête + pied de facture, sans lignes | ✓ Toléré provisoirement |
| **BASIC** | BASIC WL + lignes | ✓ Conforme EN 16931 |
| **EN 16931** | 165 champs norme européenne complète | ✓ Socle légal requis |
| **EXTENDED-CTC-FR** | EN 16931 + extensions françaises | ✓ Recommandé |

**Nouveaux champs obligatoires avec l'e-invoicing :**
1. SIREN de l'acheteur
2. Adresse de livraison (si différente)
3. Nature des opérations (livraison, service, mixte)
4. Mention paiement de la taxe d'après les débits (si applicable)

---

## 7. Backlog priorisé

### 🔴 Corrections urgentes (avant juillet 2026)

| Item | Impact | Effort | Fichiers concernés |
|---|---|---|---|
| **BUG ACRE** — taux 50% → 25% conditionnel post-juil 2026 | Cotisations sous-estimées ~960€/30k€ CA | **S** | `useCotisations.ts:52`, `settings.vue:367` |
| **Libellé Factur-X trompeur** — "Requis pour l'obligation légale" → faux | Communication erronée | **XS** | `settings.vue:402` |

### 🔴 Must-have — Phase A (0-3 mois)

| # | Feature | Valeur utilisateur (source) | Effort | Plan |
|---|---|---|---|---|
| 13 | **Relances automatiques impayés** | "Plus d'une facture sur deux arrive hors délai" (Sogexia). Feature manquante #1 dans tous les comparatifs | **M** | `2026-03-21-phase13-relances.md` |
| 14 | **Widget URSSAF par période** | Pain #2 forums. Logique déjà dans `useCotisations` — manque uniquement l'UI | **S** | `2026-03-21-phase14-widget-urssaf.md` |
| 15 | **Correction ACRE post-juillet 2026** | Bug légal avec date limite connue (1er juillet 2026) | **S** | `2026-03-21-phase15-acre-reform.md` |
| 16 | **Flux acompte → solde** | Standard pour missions forfait. Sans ça, numérotation cassée — contredit l'argument de conformité | **M** | `2026-03-21-phase16-acomptes.md` |

### 🟡 Should-have — Phase B (3-6 mois)

| # | Feature | Valeur | Effort |
|---|---|---|---|
| 17 | **QR code SEPA dans PDF** | Presque personne ne le fait. IBAN/BIC déjà dans profil. Différenciation visible sur chaque PDF | **S** |
| 18 | **Signature électronique devis (light)** | Seuls Abby (Yousign) et Evoliz l'ont. Version light = token + page publique + audit log | **M** |
| 19 | **Export livre de recettes format URSSAF** | Export CSV existe mais pas structuré pour experts-comptables | **S** |
| 20 | **Dashboard CA encaissé vs facturé** | Confusion documentée sur les forums — impact fiscal direct BNC | **S** |
| 21 | **Import migration depuis Henrri/Abby** | Lever le frein au switching pour les utilisateurs qui fuient les bugs Abby / lenteurs Henrri | **M** |

### 🟢 Could-have — Phase C (6-12 mois)

| # | Feature | Valeur | Effort |
|---|---|---|---|
| 22 | **Factur-X EN 16931 (BASIC)** | Obligation légale émission sept 2027 | **L** |
| 23 | **Documentation raccordement PA** | Ne pas devenir PA — générer EN 16931 + documenter connexion Indy/Pennylane API | **M** |
| 24 | **Paiement en ligne Stripe** | L'utilisateur configure ses propres clés Stripe (cohérent self-hosting) | **L** |
| 25 | **Notifications email hebdomadaires** | Récapitulatif CA, relances, deadline URSSAF | **M** |

### ❌ Won't have (justifié)

| Feature | Raison |
|---|---|
| App mobile native | PWA suffit pour l'audience self-hosted. Maintenance iOS/Android disproportionnée |
| Synchronisation bancaire | Nécessite agrément DSP2 — incompatible avec le self-hosting légalement |
| Devenir Plateforme Agréée | 106 PAs déjà immatriculées. Bonne stratégie : générer EN 16931 + documenter raccordement |
| Comptabilité complète (bilan, grand livre) | Hors scope BNC micro. Indy/Pennylane ont des équipes 10x plus grandes |
| Multi-devises | <5% des ME BNC facturent hors zone euro |
| Chatbot IA | Zéro valeur métier pour ME BNC, risque confidentialité |
| Multi-entreprise | Minorité absolue, complexité DB non justifiée |

---

## 8. Roadmap

```
Phase A — 0-3 mois : Corrections + Fondamentaux manquants
├── BUG: Correction ACRE post-juil 2026 (S)
├── FIX: Libellé Factur-X trompeur (XS)
├── Phase 13: Relances automatiques impayés (M)
├── Phase 14: Widget URSSAF par période (S)
└── Phase 16: Flux acompte → solde (M)

Phase B — 3-6 mois : Différenciation
├── QR code SEPA dans PDF (S)
├── Signature électronique devis light (M)
├── Export livre de recettes format URSSAF (S)
├── Dashboard CA encaissé vs facturé (S)
└── Import migration Henrri/Abby (M)

Phase C — 6-12 mois : Conformité e-invoicing 2027
├── Factur-X EN 16931 BASIC (L)
├── Documentation raccordement PA (M)
└── Paiement en ligne Stripe (L)
```

---

## 9. Opportunité myAE — Stratégie de capture

138 000 utilisateurs déplacés en janvier 2025. Une fraction cherche encore une alternative stable.

**Actions concrètes :**

1. **Page `/migration-myae`** — guide d'import + comparatif honnête. SEO : "alternative myAE" encore cherché activement.
2. **Import CSV universel** — parseur Henrri + Abby pour lever le frein au switching.
3. **Argument "anti-fermeture"** — *"Vos factures sont dans votre base Supabase. facture.dev peut disparaître, vos données restent."* Antithèse exacte de myAE.
4. **`docker-compose.yml` clé en main** — installation en une commande pour rendre le self-hosting accessible aux non-techniciens.
5. **Présence communautaire** — r/AutoEntrepreneur, groupes Facebook ME, forums AE. Réponses précises aux questions de migration.

**Cible réaliste :** 1-2% = 1 400 à 2 800 utilisateurs actifs, base de feedback pour le roadmap Phase C.

---

## 10. Positionnement différenciant

**Contre Abby et Henrri :** Là où Abby envoie des RIB au mauvais client et Henrri rame chaque semaine, facture.dev repose sur une immutabilité RLS en base de données et une numérotation atomique PostgreSQL — vos données de facturation ne peuvent pas être corrompues, ni par un bug, ni par un tiers.

**Contre Indy et Freebe :** facture.dev est la seule solution de facturation française entièrement auto-hébergée — vos factures restent sur votre infrastructure, sans abonnement qui peut disparaître du jour au lendemain comme myAE en janvier 2025.

**Différenciant absolu :** Taillé pour le BNC français — proratisation des seuils à l'euro près, cotisations URSSAF calculées par période de déclaration, pas un outil générique traduit du suédois avec des règles fiscales approximatives.

---

*Sources : service-public.fr, urssaf.fr, fnfe-mpe.org, autoentrepreneur.urssaf.fr, admarel.fr, Trustpilot (Indy/Abby/Pennylane/Freebe/Henrri), WebRankInfo, LeBonLogiciel, myAE.fr, Indy.fr blog, independant.io, lecoindesentrepreneurs.fr, legisocial.fr, jaimelapaperasse.com — Mars 2026*
