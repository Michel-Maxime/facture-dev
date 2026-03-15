---
name: vue-conventions
description: Vue.js 3 conventions. Auto-invoked for Vue components, composables, pages.
---
# Vue 3 conventions
- ALWAYS `<script setup lang="ts">` + Composition API. NEVER Options API.
- Composables (useXxx.ts) for business logic. Components in ui/ are dumb.
- Pinia for global state only (auth, UI). Domain data in composables.
- Zod + vee-validate for forms. File-based routing (unplugin-vue-router).
- Supabase generated types: `npx supabase gen types typescript --local > src/lib/types.ts`
