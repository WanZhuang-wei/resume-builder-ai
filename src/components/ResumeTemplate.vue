<template>
  <div class="resume-template">
    <div class="r-content" v-html="renderedContent"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  content: { type: String, default: '' }
})

const renderedContent = computed(() => {
  if (!props.content) return '<p style="color:#999">暂无内容</p>'
  let text = props.content
    .replace(/【(.*?)】/g, '<h3 class="r-section-title">$1</h3>')
    .replace(/\|/g, '<span class="r-sep">|</span>')
    .replace(/- (.+)/g, '<li class="r-item">$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
  text = '<p>' + text + '</p>'
  return text
})
</script>

<style scoped>
.resume-template {
  font-size: 13px;
  line-height: 1.8;
  color: #333;
}

.r-content :deep(.r-section-title) {
  font-size: 15px;
  font-weight: 700;
  color: #1989fa;
  margin: 12px 0 6px;
  padding-bottom: 4px;
  border-bottom: 2px solid #1989fa;
}

.r-content :deep(p) {
  margin-bottom: 4px;
}

.r-content :deep(.r-sep) {
  color: #999;
  margin: 0 6px;
}

.r-content :deep(.r-item) {
  list-style: none;
  padding-left: 12px;
  position: relative;
}

.r-content :deep(.r-item::before) {
  content: '•';
  position: absolute;
  left: 0;
  color: #1989fa;
}
</style>
