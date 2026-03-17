import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('authStore.isProfileComplete', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns false when profile is null', () => {
    const store = useAuthStore()
    store.profile = null
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns false when SIRET is missing', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: 'Jean', last_name: 'Dupont',
      address: '12 rue test', city: 'Paris', postal_code: '75001',
      siret: '',
    } as any
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns false when address is missing', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: 'Jean', last_name: 'Dupont',
      address: '', city: 'Paris', postal_code: '75001',
      siret: '12345678901234',
    } as any
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns false when first_name is missing', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: '', last_name: 'Dupont',
      address: '12 rue test', city: 'Paris', postal_code: '75001',
      siret: '12345678901234',
    } as any
    expect(store.isProfileComplete).toBe(false)
  })

  it('returns true when all required fields are present', () => {
    const store = useAuthStore()
    store.profile = {
      first_name: 'Jean', last_name: 'Dupont',
      address: '12 rue de la Paix', city: 'Paris', postal_code: '75001',
      siret: '12345678901234',
    } as any
    expect(store.isProfileComplete).toBe(true)
  })
})
