import os

p = r"D:\workspace\project002_简历生成助手\src\views\DocumentUpload.vue"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()

# Make the upload zone more prominent
old_zone = '''    <div
        class="upload-zone"
        :class="{ 'drag-over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <van-icon name="plus" class="upload-icon" />
        <p class="upload-text">{{ uploading ? '澶勭悊涓?..' : '鐐硅嚮鎴栨嫋鎷芥枃浠跺埌姝ゅ' }}</p>
        <p class="upload-hint">鏀寔 .pdf .docx .txt 鏍煎紡锛屽崟涓枃浠朵笉瓒呰繃 10MB</p>
        <input ref="fileInput" type="file" accept=".pdf,.docx,.txt" style="display:none" @change="handleFileChange" />
      </div>'''

new_zone = '''    <div
        class="upload-zone"
        :class="{ 'drag-over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <van-icon name="plus" class="upload-icon" />
        <p class="upload-text">{{ uploading ? '澶勭悊涓?..' : '鐐瑰嚮杩欓噷锛堟垨鎷栨嫋鏂囦欢鍒版澶勶級' }}</p>
        <p class="upload-hint">鏀寔 .pdf .docx .txt 鏍煎紡 路 鍗曚釜鏂囦欢涓嶈秴杩?10MB</p>
        <input ref="fileInput" type="file" accept=".pdf,.docx,.txt" style="display:none" @change="handleFileChange" />
      </div>'''

if old_zone in c:
    c = c.replace(old_zone, new_zone)
    print("Upload zone updated")
else:
    print("WARN: Upload zone not found (charset mismatch)")
    # Try to find the zone by partial match
    idx = c.find("upload-zone")
    if idx > 0:
        print("Found upload-zone at", idx)
    idx2 = c.find("click")
    if idx2 > 0:
        print("Found 'click' at", idx2)

with open(p, "w", encoding="utf-8") as f:
    f.write(c)
print("Done")