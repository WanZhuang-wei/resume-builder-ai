 <template>
   <van-dialog v-model:show="visible" title="配置 API Key" close-on-click-overlay @closed="handleClose">
     <div class="api-dialog-body">
       <div class="dialog-intro">
         <van-icon name="info-o" style="color:#1989fa;margin-right:6px" />
         需要 DeepSeek API Key 才能使用 AI 功能
       </div>
       <van-form @submit="handleSave" ref="formRef">
         <van-field
           v-model="keyValue"
           :type="showKey ? 'text' : 'password'"
           label="API Key"
           placeholder="sk-..."
           clearable
           :rules="[{ required: true, message: '请填写 API Key' }]"
         >
           <template #right-icon>
             <van-icon :name="showKey ? 'eye-o' : 'closed-eye'" @click="showKey = !showKey" style="cursor:pointer;color:#999" />
           </template>
         </van-field>
         <div class="dialog-hint">Key 仅存储在浏览器本地</div>
         <div class="dialog-actions">
           <van-button round block type="primary" native-type="submit" size="small" :loading="saving">
             保存并继续
           </van-button>
           <van-button v-if="keyValue" round block plain type="primary" size="small" :loading="testing" @click="testConnection" style="margin-top:8px">
             {{ testResult || '测试连接' }}
           </van-button>
           <div class="dialog-link">
             <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">获取 Key →</a>
           </div>
         </div>
       </van-form>
     </div>
   </van-dialog>
 </template>
 
 <script setup>
 import { ref, watch } from 'vue'
 import { showToast } from 'vant'
 import { useSettingsStore } from '@/stores/settings'
 import { chat } from '@/api/deepseek'
 
 const props = defineProps({
   modelValue: { type: Boolean, default: false }
 })
 
 const emit = defineEmits(['update:modelValue', 'saved'])
 
 const settingsStore = useSettingsStore()
 
 const visible = ref(props.modelValue)
 const keyValue = ref(settingsStore.apiKey || '')
 const showKey = ref(false)
 const saving = ref(false)
 const testing = ref(false)
 const testResult = ref('')
 
 watch(() => props.modelValue, (val) => {
   visible.value = val
   if (val) {
     keyValue.value = settingsStore.apiKey || ''
     testResult.value = ''
   }
 })
 
 watch(visible, (val) => {
   emit('update:modelValue', val)
 })
 
 function handleClose() {
   testResult.value = ''
 }
 
 async function handleSave() {
   if (!keyValue.value) return
   saving.value = true
   settingsStore.setApiKey(keyValue.value)
   testResult.value = ''
   saving.value = false
   emit('saved')
   visible.value = false
 }
 
 async function testConnection() {
   if (!keyValue.value) {
     showToast('请先填写 API Key')
     return
   }
   testing.value = true
   testResult.value = ''
   settingsStore.setApiKey(keyValue.value)
   try {
     const response = await chat([{ role: 'user', content: '回复"连接成功"四个字' }], { maxTokens: 10, temperature: 0 })
     if (response.includes('连接成功')) {
       testResult.value = '✅ 连接成功'
       showToast({ message: 'API 连接正常', type: 'success' })
     } else {
       testResult.value = '⚠️ 响应异常'
     }
   } catch (e) {
     testResult.value = '❌ 连接失败'
     showToast({ message: '连接失败：' + e.message, type: 'fail' })
   } finally {
     testing.value = false
   }
 }
 </script>
 
 <style scoped>
 .api-dialog-body { padding: 0 8px; }
 .dialog-intro { font-size: 13px; color: #666; margin: 0 8px 12px; padding: 8px 10px; background: #f0f7ff; border-radius: 6px; display: flex; align-items: center; }
 .dialog-hint { font-size: 11px; color: #999; padding: 0 16px 8px; }
 .dialog-actions { padding: 0 16px 12px; }
 .dialog-link { text-align: center; margin-top: 10px; font-size: 12px; }
 .dialog-link a { color: #1989fa; text-decoration: none; }
 </style>
