<template>
  <div class="hr-info-card">
    <div class="avatar">{{ initials }}</div>
    <h1 class="candidate-name">{{ name }}</h1>
    <p class="candidate-title">{{ title }}</p>
    <p class="candidate-summary">{{ summary }}</p>
    <div class="contact-info">
      <div v-if="contact.phone" class="contact-item">
        <van-icon name="phone-o" /> {{ contact.phone }}
      </div>
      <div v-if="contact.wechat" class="contact-item">
        <van-icon name="chat-o" /> {{ contact.wechat }}
      </div>
      <div v-if="contact.email" class="contact-item">
        <van-icon name="envelop-o" /> {{ contact.email }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '求职者' },
  title: { type: String, default: '' },
  summary: { type: String, default: '' },
  targetPosition: { type: String, default: '' },
  contact: { type: Object, default: () => ({}) }
})

const initials = computed(() => {
  if (!props.name) return '?'
  return props.name.charAt(0)
})
</script>

<style scoped>
.hr-info-card {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #1989fa, #07c160);
  color: #fff;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0 auto 12px;
}

.candidate-name {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.candidate-title {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.candidate-summary {
  font-size: 13px;
  opacity: 0.8;
  line-height: 1.5;
  margin-bottom: 16px;
}

.contact-info {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.contact-item {
  background: rgba(255,255,255,0.15);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
