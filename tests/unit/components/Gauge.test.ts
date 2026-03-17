import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Gauge from '@/components/ui/Gauge.vue'

// ALERT_THRESHOLDS: { warning: 0.80, danger: 0.95 }

describe('Gauge', () => {
  it('renders the label', () => {
    const wrapper = mount(Gauge, { props: { value: 0.5, label: 'Seuil TVA' } })
    expect(wrapper.text()).toContain('Seuil TVA')
  })

  it('uses green color for safe values (< 80%)', () => {
    const wrapper = mount(Gauge, { props: { value: 0.5, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#059669')
    expect(html).not.toContain('#D97706')
    expect(html).not.toContain('#DC2626')
  })

  it('uses amber color for warning values (>= 80%, < 95%)', () => {
    const wrapper = mount(Gauge, { props: { value: 0.85, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#D97706')
    expect(html).not.toContain('#DC2626')
    expect(html).not.toContain('#059669')
  })

  it('uses red color for danger values (>= 95%)', () => {
    const wrapper = mount(Gauge, { props: { value: 0.95, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#DC2626')
    expect(html).not.toContain('#D97706')
    expect(html).not.toContain('#059669')
  })

  it('uses red color at 100%', () => {
    const wrapper = mount(Gauge, { props: { value: 1, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#DC2626')
  })

  it('uses green color at 0%', () => {
    const wrapper = mount(Gauge, { props: { value: 0, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#059669')
  })

  it('uses green at exactly 79% (below warning threshold)', () => {
    const wrapper = mount(Gauge, { props: { value: 0.79, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#059669')
  })

  it('uses amber at exactly 80% (warning threshold)', () => {
    const wrapper = mount(Gauge, { props: { value: 0.80, label: 'Test' } })
    const html = wrapper.html()
    expect(html).toContain('#D97706')
  })

  it('renders current and threshold values when provided', () => {
    const wrapper = mount(Gauge, {
      props: { value: 0.5, label: 'Test', current: 5000, threshold: 10000 },
    })
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('10')
  })

  it('clamps values above 1 to 1', () => {
    const wrapper = mount(Gauge, { props: { value: 1.5, label: 'Test' } })
    const html = wrapper.html()
    // At clamped value 1.0 >= 0.95, should be danger color
    expect(html).toContain('#DC2626')
  })

  it('clamps negative values to 0', () => {
    const wrapper = mount(Gauge, { props: { value: -0.5, label: 'Test' } })
    const html = wrapper.html()
    // At clamped value 0 < 0.80, should be safe color
    expect(html).toContain('#059669')
  })
})
