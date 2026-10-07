<template>
  <button type="button" class="theme-toggle" :aria-label="label" :title="label" @click="toggle">
    <!-- Both icons render; CSS shows the right one before hydration (see BaseLayout). -->
    <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
    <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')
const label = computed(() => (theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'))
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')

// The head script (lib/theme-init.mjs) applied any saved choice; otherwise the system's applies.
function current(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return systemDark().matches ? 'dark' : 'light'
}

function apply(next: Theme, save: boolean) {
  theme.value = next
  document.documentElement.dataset.theme = next
  if (!save) return
  try {
    localStorage.setItem('theme', next)
  } catch {}
}

function toggle() {
  apply(theme.value === 'dark' ? 'light' : 'dark', true)
}

onMounted(() => {
  theme.value = current()
  systemDark().addEventListener('change', () => (theme.value = current()))
  // Keeps other open tabs in step.
  window.addEventListener('storage', (event) => {
    if (event.key === 'theme' && (event.newValue === 'light' || event.newValue === 'dark')) apply(event.newValue, false)
  })
})
</script>

<style scoped>
.theme-toggle {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.theme-toggle:hover {
  border-color: var(--rule);
  color: var(--accent);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.icon-moon {
  fill: currentColor;
  stroke: none;
}
</style>
