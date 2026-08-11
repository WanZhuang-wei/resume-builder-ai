/**
 * 文档解析工具 — 从 PDF/DOCX/TXT 中提取纯文本
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { metrics } from "@/utils/metrics";

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

async function parseTxt(file) {
  return await readAsText(file);
}

async function parsePdf(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  const arrayBuffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return text;
}

async function parseDocx(file) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function parseDocument(file) {
  const name = file.name.toLowerCase();
  const startTime = performance.now();
  let fileType = "unknown";

  try {
    if (name.endsWith(".txt")) {
      const text = await parseTxt(file);
      fileType = "txt";
      const duration = performance.now() - startTime;
      metrics.recordParse({ format: fileType, duration, success: true });
      return { text: text.trim(), fileType };
    }

    if (name.endsWith(".pdf")) {
      const text = await parsePdf(file);
      fileType = "pdf";
      const duration = performance.now() - startTime;
      metrics.recordParse({ format: fileType, duration, success: true });
      return { text: text.trim(), fileType };
    }

    if (name.endsWith(".docx")) {
      const text = await parseDocx(file);
      fileType = "docx";
      const duration = performance.now() - startTime;
      metrics.recordParse({ format: fileType, duration, success: true });
      return { text: text.trim(), fileType };
    }

    if (name.endsWith(".doc")) {
      throw new Error("不支持 .doc 格式（旧版 Word），请先转换为 .docx 或 .pdf");
    }

    throw new Error("不支持的文件格式，仅支持 .txt, .pdf, .docx");
  } catch (err) {
    const duration = performance.now() - startTime;
    metrics.recordParse({ format: fileType, duration, success: false });
    throw err;
  }
}

/** 检查文件大小（上限 10MB） */
export function checkFileSize(file) {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("文件过大，请上传小于 10MB 的文件");
  }
  return true;
}

/**
 * 估算解析文本的信息完整度（0-100）
 * 用于在 MetricsCollector 中记录数据质量
 */
export function estimateAccuracy(parsedText) {
  if (!parsedText || typeof parsedText !== "string" || parsedText.trim().length < 10) return 0;

  const checks = [
    [/姓名|名字|Name[：:\s]/i, 15],
    [/1[3-9]\d{9}/, 15],
    [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, 15],
    [/[本硕博]|大学|学院|学校/, 15],
    [/Python|Java|技能|掌握|熟练|精通/, 15],
    [/工作经验|工作经历/, 15],
    [/项目经验|项目/, 10],
  ];

  let score = 0;
  for (const [pattern, weight] of checks) {
    if (pattern.test(parsedText)) score += weight;
  }

  return Math.min(100, score);
}
