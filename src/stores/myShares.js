import { defineStore } from 'pinia'
import { ref } from 'vue'
import db from '@/db'

export const useMySharesStore = defineStore('myShares', () => {
  const items = ref([])
  const loaded = ref(false)

  async function load() {
    items.value = await db.myShares.orderBy('createdAt').reverse().toArray()
    loaded.value = true
    return items.value
  }

  async function upsert(record) {
    const existing = await db.myShares.where('shareId').equals(record.shareId).first()
    if (existing) {
      await db.myShares.update(existing.id, { ...record, updatedAt: Date.now() })
    } else {
      await db.myShares.add({ ...record, updatedAt: Date.now() })
    }
    await load()
  }

  async function remove(shareId) {
    const existing = await db.myShares.where('shareId').equals(shareId).first()
    if (existing) await db.myShares.delete(existing.id)
    await load()
  }

  async function updateOne(shareId, patch) {
    const existing = await db.myShares.where('shareId').equals(shareId).first()
    if (existing) await db.myShares.update(existing.id, { ...patch, updatedAt: Date.now() })
    await load()
  }

  return { items, loaded, load, upsert, remove, updateOne }
})
