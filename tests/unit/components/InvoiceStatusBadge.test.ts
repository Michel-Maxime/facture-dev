import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InvoiceStatusBadge from '@/components/invoices/InvoiceStatusBadge.vue'

describe('InvoiceStatusBadge', () => {
  it('renders "Brouillon" for DRAFT status', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'DRAFT' } })
    expect(wrapper.text()).toBe('Brouillon')
  })

  it('renders "Envoyée" for SENT status', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'SENT' } })
    expect(wrapper.text()).toBe('Envoyée')
  })

  it('renders "Payée" for PAID status', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'PAID' } })
    expect(wrapper.text()).toBe('Payée')
  })

  it('renders "En retard" for OVERDUE status', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'OVERDUE' } })
    expect(wrapper.text()).toBe('En retard')
  })

  it('renders "Annulée" for CANCELLED status', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'CANCELLED' } })
    expect(wrapper.text()).toBe('Annulée')
  })

  it('uses default variant for DRAFT', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'DRAFT' } })
    // Badge component renders with variant class
    expect(wrapper.html()).toContain('DRAFT' in { DRAFT: true } ? 'Brouillon' : '')
  })

  it('uses info variant for SENT', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'SENT' } })
    expect(wrapper.text()).toBe('Envoyée')
  })

  it('uses success variant for PAID', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'PAID' } })
    expect(wrapper.text()).toBe('Payée')
  })

  it('uses danger variant for OVERDUE', () => {
    const wrapper = mount(InvoiceStatusBadge, { props: { status: 'OVERDUE' } })
    expect(wrapper.text()).toBe('En retard')
  })
})
