import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { computeFingerprint } from "@/utils/fingerprint";
import { getDeviceId } from "@/utils/tracker";
import { useMySharesStore } from "@/stores/myShares";

// 本地开发时用 .env 的 VITE_SHARE_API，部署后与前端同源
const SHARE_API = import.meta.env.VITE_SHARE_API || window.location.origin;
const DEFAULT_TTL_MS = 40 * 24 * 60 * 60 * 1000;

export const useShareStore = defineStore("share", () => {
  const selectedContact = ref({
    showPhone: true,
    showWechat: true,
    showEmail: true,
  });
  const selectedSections = ref({
    basicInfo: true,
    workExperiences: true,
    education: true,
    projects: true,
    skills: true,
    certificates: false,
  });
  const shareLink = ref("");
  const generating = ref(false);
  const manageToken = ref("");
  const lastShareId = ref("");

  // ---- view count tracking ----
  const viewCounts = ref(_loadViewCounts());

  function _loadViewCounts() {
    try {
      const saved = globalThis.localStorage?.getItem("resume_share_views");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  function _saveViewCounts() {
    try {
      globalThis.localStorage?.setItem(
        "resume_share_views",
        JSON.stringify(viewCounts.value)
      );
    } catch {
      // localStorage not available
    }
  }

  function incrementViewCount(shareToken) {
    if (!shareToken) return;
    const key = String(shareToken).slice(0, 20);
    viewCounts.value[key] = (viewCounts.value[key] || 0) + 1;
    _saveViewCounts();
  }

  function getViewCount(shareToken) {
    const key = shareToken ? String(shareToken).slice(0, 20) : "";
    return key ? viewCounts.value[key] || 0 : 0;
  }
  // ---- end view count ----

  const urlLength = computed(() => {
    return shareLink.value ? shareLink.value.length : 0
  });

  function buildShareData(profileData) {
    const shareData = { contact: {}, profile: {} };

    if (selectedContact.value.showPhone && profileData.basicInfo?.phone) {
      shareData.contact.phone = profileData.basicInfo.phone;
    }
    if (selectedContact.value.showWechat && profileData.basicInfo?.wechat) {
      shareData.contact.wechat = profileData.basicInfo.wechat;
    }
    if (selectedContact.value.showEmail && profileData.basicInfo?.email) {
      shareData.contact.email = profileData.basicInfo.email;
    }

    if (selectedSections.value.basicInfo && profileData.basicInfo) {
      shareData.profile.basicInfo = {
        name: profileData.basicInfo.name,
        title: profileData.basicInfo.title,
        summary: profileData.basicInfo.summary,
        targetPosition: profileData.basicInfo.targetPosition,
      };
    }
    if (selectedSections.value.workExperiences) {
      shareData.profile.workExperiences = profileData.workExperiences || [];
    }
    if (selectedSections.value.education) {
      shareData.profile.education = profileData.education || [];
    }
    if (selectedSections.value.projects) {
      shareData.profile.projects = profileData.projects || [];
    }
    if (selectedSections.value.skills) {
      shareData.profile.skills = profileData.skills || [];
    }
    if (selectedSections.value.certificates) {
      shareData.profile.certificates = profileData.certificates || [];
    }
    return shareData;
  }

  async function generateShareLink(profileData, { forceNew = false } = {}) {
    generating.value = true;
    try {
      const shareData = buildShareData(profileData);
      const fingerprint = await computeFingerprint(shareData);

      // POST 到分享服务器，拿短 ID（同指纹会复用稳定链接）
      const res = await fetch(SHARE_API + '/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: shareData.profile,
          contact: shareData.contact,
          fingerprint,
          forceNew,
          deviceId: getDeviceId(),
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || ('服务器错误 ' + res.status));
      }
      const result = await res.json();

      const baseUrl = window.location.origin + window.location.pathname;
      const link = baseUrl + '#/hr/' + result.id;
      shareLink.value = link;
      manageToken.value = result.manageToken || "";
      lastShareId.value = result.id;

      // 记录到本机“我的分享”（IndexedDB）
      try {
        const myShares = useMySharesStore();
        await myShares.upsert({
          shareId: result.id,
          manageToken: result.manageToken || "",
          createdAt: Date.now(),
          expiresAt: Date.now() + DEFAULT_TTL_MS,
          link,
          fingerprint,
          status: "active",
        });
      } catch (e) {
        console.warn('[share] save to myShares failed', e)
      }

      return {
        link,
        id: result.id,
        manageToken: result.manageToken || "",
        reused: !!result.reused,
      };
    } finally {
      generating.value = false;
    }
  }

  function getUrlWarning() {
    return "";
  }

  return {
    selectedContact,
    selectedSections,
    shareLink,
    generating,
    manageToken,
    lastShareId,
    urlLength,
    viewCounts,
    incrementViewCount,
    getViewCount,
    generateShareLink,
    getUrlWarning,
  };
});
