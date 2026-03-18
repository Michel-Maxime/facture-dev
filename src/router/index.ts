import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/register.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/index.vue'),
        },
        {
          path: 'invoices',
          name: 'invoices',
          component: () => import('@/pages/invoices/index.vue'),
        },
        {
          path: 'invoices/new',
          name: 'invoice-new',
          component: () => import('@/pages/invoices/new.vue'),
        },
        {
          path: 'invoices/:id',
          name: 'invoice-detail',
          component: () => import('@/pages/invoices/[id].vue'),
        },
        {
          path: 'invoices/:id/edit',
          name: 'invoice-edit',
          component: () => import('@/pages/invoices/edit.vue'),
        },
        {
          path: 'credit-notes',
          name: 'credit-notes',
          component: () => import('@/pages/credit-notes/index.vue'),
        },
        {
          path: 'credit-notes/:id',
          name: 'credit-note-detail',
          component: () => import('@/pages/credit-notes/[id].vue'),
        },
        {
          path: 'quotes',
          name: 'quotes',
          component: () => import('@/pages/quotes/index.vue'),
        },
        {
          path: 'recurring',
          name: 'recurring',
          component: () => import('@/pages/recurring/index.vue'),
        },
        {
          path: 'clients',
          name: 'clients',
          component: () => import('@/pages/clients/index.vue'),
        },
        {
          path: 'clients/:id',
          name: 'client-detail',
          component: () => import('@/pages/clients/[id].vue'),
        },
        {
          path: 'ledger',
          name: 'ledger',
          component: () => import('@/pages/ledger.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/settings.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(authGuard)

export default router
