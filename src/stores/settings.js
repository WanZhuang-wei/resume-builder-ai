import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref(localStorage.getItem('deepseek_api_key') || '')
  const theme = ref(localStorage.getItem('theme') || 'light')

  function setApiKey(key) {
    apiKey.value = key
    localStorage.setItem('deepseek_api_key', key)
  }

  function clearApiKey() {
    apiKey.value = ''
    localStorage.removeItem('deepseek_api_key')
  }

  return { apiKey, theme, setApiKey, clearApiKey }
})
