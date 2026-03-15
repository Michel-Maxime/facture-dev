import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(true)

  const storedTheme = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('theme') as 'light' | 'dark' | null)
    : null
  const theme = ref<'light' | 'dark'>(storedTheme ?? 'light')

  // Sync theme to <html> class and localStorage
  function applyTheme(t: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', t)
    }
  }

  applyTheme(theme.value)

  watch(theme, applyTheme)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return { sidebarOpen, theme, toggleSidebar, toggleTheme }
})
