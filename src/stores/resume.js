import { defineStore } from "pinia";
import { ref } from "vue";
import db from "@/db";
import { generateResume } from "@/api/deepseek";
import { metrics } from "@/utils/metrics";
import { logAction } from "@/utils/actionLog";
import { calculateKeywordMatch } from "@/utils/jobMatcher";

export const useResumeStore = defineStore("resume", () => {
  const savedResumes = ref([]);
  const generating = ref(false);
  const currentContent = ref("");
  const _lastGeneratedContent = ref("");

  async function loadSaved() {
    savedResumes.value = await db.resumes.toArray();
  }

  async function generate(
    profileData,
    company,
    position,
    jobDescription,
    templateText
  ) {
    generating.value = true;
    logAction("resume.generate", { status: "started", payload: { company, position, hasJd: !!jobDescription } });
    try {
      const content = await generateResume(
        profileData,
        company,
        position,
        jobDescription,
        templateText
      );
      currentContent.value = content;
      _lastGeneratedContent.value = content;
      logAction("resume.generate", { status: "success", payload: { company, position, hasJd: !!jobDescription } });
      return content;
    } catch (e) {
      logAction("resume.generate", { status: "failed", payload: { company, position }, error: e });
      throw e;
    } finally {
      generating.value = false;
    }
  }

  async function saveCurrent(targetCompany, targetPosition, jobDescription) {
    try {
      logAction("resume.save", { status: "started", payload: { company: targetCompany, position: targetPosition, hasJd: !!jobDescription } });
      const entry = {
        targetCompany,
        targetPosition,
        jobDescription: jobDescription || '',
        content: currentContent.value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const id = await db.resumes.add(entry);
      savedResumes.value.push({ ...entry, id });

      // Track edit vs direct save
      const edited =
        _lastGeneratedContent.value &&
        currentContent.value !== _lastGeneratedContent.value;

      // Compute simple match score if JD is provided
      let matchScore = null;
      if (jobDescription && currentContent.value) {
        try {
          const result = calculateKeywordMatch(
            jobDescription,
            currentContent.value
          );
          matchScore = result.score;
        } catch {
          // jobMatcher may not be available
        }
      }

      metrics.recordGeneration({
        matchScore: matchScore,
        userEdited: edited,
      });

      logAction("resume.save", { status: "success", payload: { company: targetCompany, position: targetPosition, hasJd: !!jobDescription, matchScore, resumeId: id } });
      return id;
    } catch (e) {
      logAction("resume.save", { status: "failed", payload: { company: targetCompany, position: targetPosition }, error: e });
      throw e;
    }
  }

  async function deleteResume(id) {
    try {
      await db.resumes.delete(id);
      savedResumes.value = savedResumes.value.filter((r) => r.id !== id);
      logAction("resume.delete", { status: "success", payload: { resumeId: id } });
    } catch (e) {
      logAction("resume.delete", { status: "failed", payload: { resumeId: id }, error: e });
      throw e;
    }
  }

  function setContent(content) {
    currentContent.value = content;
  }

  return {
    savedResumes,
    generating,
    currentContent,
    loadSaved,
    generate,
    saveCurrent,
    deleteResume,
    setContent,
  };
});
