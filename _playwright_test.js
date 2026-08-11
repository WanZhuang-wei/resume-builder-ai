/**
 * Playwright 自动化测试脚本
 * 用法: 先启动 Vite，再运行此脚本: node _playwright_test.js
 * 或由 _run_playwright.ps1 自动管理 Vite 生命周期
 * 
 * 环境变量:
 *   BASE_URL  - 测试地址（默认 http://localhost:5173）
 *   HEADLESS  - 是否无头模式（默认 true）
 *   SLOWMO    - 操作延迟毫秒（默认 100）
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS !== 'false';
const SLOWMO = parseInt(process.env.SLOWMO || '100', 10);
const RESULT_DIR = path.join(__dirname, 'test-results');

if (!fs.existsSync(RESULT_DIR)) {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
}

let passed = 0, failed = 0, failures = [];

function check(cond, msg) {
  if (cond) { passed++; console.log('  V ' + msg); }
  else { failures.push(msg); failed++; console.log('  X ' + msg); }
}

async function shot(name) {
  const p = path.join(RESULT_DIR, name + '.png');
  await page.screenshot({ path: p, fullPage: true });
  console.log('  [截图] ' + p);
}

async function go(hash) {
  await page.goto(BASE_URL + '/#' + hash, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
}

async function text(sel) {
  return await page.evaluate((s) => {
    const el = document.querySelector(s || 'body');
    return el ? el.innerText.substring(0, 300) : '';
  }, sel);
}

let browser, page, pageCtx;

async function main() {
  console.log('='.repeat(60));
  console.log('Playwright 自动化测试');
  console.log('  测试地址: ' + BASE_URL);
  console.log('  截图保存: ' + RESULT_DIR);
  console.log('='.repeat(60));

  browser = await chromium.launch({
    headless: HEADLESS, slowMo: SLOWMO,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  pageCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
  page = await pageCtx.newPage();

  const tests = [
    ['dashboard - 仪表盘', async () => {
      await go('/dashboard');
      check(await page.title() !== '', '页面有 title');
      check((await text()).length > 0, '页面有内容');
      check(!!(await page.$('.van-tabbar')), '底部导航栏存在');
      await shot('01-dashboard');
    }],
    ['profile - 个人资料', async () => {
      await go('/profile');
      check(!!(await page.$('.van-field')), '有输入字段');
      check((await text()).length > 0, '页面有内容');
      await shot('02-profile');
    }],
    ['resume - 简历生成', async () => {
      await go('/resume');
      check((await text()).length > 0, '页面有内容');
      check((await page.$$('button, .van-button')).length > 0, '有可交互按钮');
      await shot('03-resume');
    }],
    ['chat - AI 问答', async () => {
      await go('/chat');
      check((await text()).length > 0, '页面有内容');
      await shot('04-chat');
    }],
    ['settings - 设置', async () => {
      await go('/settings');
      check((await text()).length > 0, '页面有内容');
      await shot('05-settings');
    }],
    ['collect - 职位采集', async () => {
      await go('/collect');
      check((await text()).length > 0, '页面有内容');
      await shot('06-collect');
    }],
    ['navigation - 导航', async () => {
      await go('/dashboard');
      const items = await page.$$('.van-tabbar-item');
      if (items.length > 0) {
        check(items.length >= 3, '底部导航有 ' + items.length + ' 个标签');
        if (items.length >= 2) {
          await items[1].click();
          await page.waitForTimeout(800);
          check(page.url() !== BASE_URL + '/#/dashboard', '点击后 URL 改变');
        }
      }
      await shot('07-navigation');
    }],
    ['profile - save and restore', async () => {
      await go('/profile');
      const testName = 'QA\u6d4b\u8bd5' + Date.now();
      const nameInput = page.locator('input[placeholder="\u8bf7\u8f93\u5165\u59d3\u540d"]');
      await nameInput.fill(testName);
      await page.getByRole('button', { name: '\u4fdd\u5b58\u57fa\u672c\u4fe1\u606f' }).click();
      await page.waitForTimeout(800);
      await page.reload({ waitUntil: 'networkidle' });
      await go('/profile');
      const value = await page.locator('input[placeholder="\u8bf7\u8f93\u5165\u59d3\u540d"]').inputValue();
      check(value === testName, 'profile data restored after reload');
    }],
    ['collect - jd flows to analyzer', async () => {
      await go('/collect');
      const jd = '\u8d1f\u8d23\u524d\u7aef\u5f00\u53d1\uff0c\u9700\u8981\u638c\u63e1 Vue \u548c Node.js';
      await page.locator('input[placeholder*="\u524d\u7aef\u5de5\u7a0b\u5e08"]').fill('\u524d\u7aef\u5de5\u7a0b\u5e08');
      await page.locator('textarea[placeholder*="\u7c98\u8d34\u5c97\u4f4d\u63cf\u8ff0"]').fill(jd);
      await page.getByRole('button', { name: '\u4fdd\u5b58\u5c97\u4f4d' }).click();
      await page.waitForTimeout(800);
      await page.locator('.item-actions button', { hasText: '\u5206\u6790' }).first().click();
      await page.waitForTimeout(800);
      const value = await page.locator('textarea').first().inputValue();
      check(page.url().includes('/analyze'), 'redirect to analyzer');
      check(value.includes('\u524d\u7aef\u5f00\u53d1'), 'jd auto filled');
    }],
    ['share - checkbox toggles once', async () => {
      await go('/share');
      const cell = page.locator('.van-cell', { hasText: '\u663e\u793a\u7535\u8bdd' }).first();
      const icon = cell.locator('.van-checkbox__icon');
      const wasChecked = await icon.evaluate(el => el.classList.contains('van-checkbox__icon--checked'));
      await cell.click();
      await page.waitForTimeout(300);
      const afterCell = await icon.evaluate(el => el.classList.contains('van-checkbox__icon--checked'));
      check(afterCell === !wasChecked, 'cell click toggles once');
      await icon.click({ force: true });
      await page.waitForTimeout(300);
      const afterBox = await icon.evaluate(el => el.classList.contains('van-checkbox__icon--checked'));
      check(afterBox === wasChecked, 'checkbox click toggles once');
    }],
    ['job - favorite persists', async () => {
      await go('/job/' + encodeURIComponent('Python \u5f00\u53d1\u5de5\u7a0b\u5e08'));
      await page.waitForTimeout(1000);
      const addBtn = page.getByRole('button', { name: '\u6536\u85cf\u8be5\u5c97\u4f4d' }).first();
      await addBtn.click();
      await page.waitForTimeout(600);
      const afterAdd = await page.getByRole('button', { name: '\u53d6\u6d88\u6536\u85cf' }).count();
      check(afterAdd > 0, 'favorite button switches to cancel');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const afterReload = await page.getByRole('button', { name: '\u53d6\u6d88\u6536\u85cf' }).count();
      check(afterReload > 0, 'favorite persists after reload');
    }],
  ];

  for (const [name, fn] of tests) {
    console.log('\n[测试] ' + name);
    try { await fn(); } catch (e) { failed++; failures.push(name + ': ' + e.message); console.log('  X 异常: ' + e.message); }
  }

  await browser.close();
  console.log('\n' + '='.repeat(60));
  const total = passed + failed;
  console.log('结果: ' + passed + '/' + total + ' 通过 (' + (total > 0 ? ((passed/total)*100).toFixed(1) : '0') + '%)');
  if (failures.length > 0) { console.log('失败项:'); failures.forEach(function(f,i) { console.log('  ' + (i+1) + '. ' + f); }); }
  console.log('截图: ' + RESULT_DIR);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

await main();