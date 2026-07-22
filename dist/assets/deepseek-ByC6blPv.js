const f="https://api.deepseek.com/v1";async function g(e){return new Promise(o=>setTimeout(o,e))}async function R(e,o,n=3){var a;for(let r=0;r<n;r++)try{const t=await fetch(e,o);if(!t.ok){const s=await t.json().catch(()=>({}));throw new Error(((a=s.error)==null?void 0:a.message)||`HTTP ${t.status}`)}return await t.json()}catch(t){if(r===n-1)throw t;await g(1e3*(r+1))}}function $(){return localStorage.getItem("deepseek_api_key")||""}async function y(e,o={}){const n=$();if(!n)throw new Error("请先设置 DeepSeek API Key");const{maxTokens:a=2e3,temperature:r=.7,onStream:t}=o;return t?A(e,n,{maxTokens:a,temperature:r,onStream:t}):(await R(`${f}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({model:"deepseek-chat",messages:e,max_tokens:a,temperature:r})})).choices[0].message.content}async function A(e,o,{maxTokens:n,temperature:a,onStream:r}){var m,d,p,l;const t=await fetch(`${f}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${o}`},body:JSON.stringify({model:"deepseek-chat",messages:e,max_tokens:n,temperature:a,stream:!0})});if(!t.ok){const i=await t.json().catch(()=>({}));throw new Error(((m=i.error)==null?void 0:m.message)||`HTTP ${t.status}`)}const s=t.body.getReader(),T=new TextDecoder;let c="";for(;;){const{done:i,value:k}=await s.read();if(i)break;const S=T.decode(k,{stream:!0}).split(`
`).filter(u=>u.startsWith("data: "));for(const u of S){const h=u.slice(6).trim();if(h!=="[DONE]")try{const E=((l=(p=(d=JSON.parse(h).choices)==null?void 0:d[0])==null?void 0:p.delta)==null?void 0:l.content)||"";c+=E,r(c)}catch{}}}return c}function w(e){return`你是一个专业的简历生成和求职助手。你拥有一份求职者的个人资料数据。

你需要根据用户的需求，基于这些数据提供帮助。你的任务包括：

1. 简历生成：根据用户的目标岗位和公司，从资料中筛选最相关的工作经历、项目经验、技能等，生成一份专业的简历。使用简洁、正式的商业语言，突出成就和量化结果。

2. 问题回答：回答用户关于个人资料的问题，如"我有哪些项目经验？"等。

3. 求职建议：结合用户背景，给出求职策略和建议。当需要联网信息时，请在回答中说明"建议搜索"相关内容。

4. 岗位分析：当用户提供JD时，逐项分析匹配度，给出优劣势评估和改进建议。

当前的个人资料：
${JSON.stringify(e,null,2)}

请注意：
- 简历生成时，只使用提供的资料中的真实信息，不要编造
- 回答要简洁、专业、有针对性
- 每次回答控制在500字以内`}function P(e){return`你是一个求职者的个人AI助手。有人在招聘过程中对你感兴趣，想了解关于这位求职者的更多信息。

以下是该求职者的个人资料：
${JSON.stringify(e,null,2)}

你的任务：
1. 回答HR关于这位求职者的项目细节、工作经历、技能等方面的问题
2. 只基于提供的资料回答，不要编造任何信息
3. 如果问题超出资料范围，诚实地回答"资料中没有相关记录"
4. 每次回答限制在500字以内
5. 用专业、诚恳的语气
6. 回答要简洁、突出重点`}async function _(e,o,n,a){const r=`请为以下求职者生成一份针对"${o||"该岗位"}"的"${n}"岗位的简历。${a?`

参考以下岗位描述进行定制：
`+a+`
`:""}

要求：
1. 从资料中筛选与该岗位最相关的工作经历、项目经验和技能
2. 按照专业简历格式组织
3. 突出与目标岗位相关的成就和能力
4. 语言简洁、专业、有说服力
5. 使用中文
6. 按以下格式输出：

【个人简介】
一句话概括

【工作经历】
公司 | 职位 | 时间
- 工作内容
- 主要成就

【项目经验】
项目名称 | 角色 | 技术栈
- 项目描述
- 个人贡献

【教育背景】
学校 | 专业 | 学位 | 时间

【技能】
分类列出相关技能

【其他】
证书、语言等`;return await y([{role:"system",content:w(e)},{role:"user",content:r}],{maxTokens:3e3,temperature:.3})}async function O(e,o){const n=`请分析以下JD与该求职者的匹配度。

JD内容：
${o}

请输出：
1. **匹配项**：列出求职者满足的JD要求
2. **不匹配项**：列出求职者不满足或缺乏的JD要求
3. **匹配度评分**（百分比）
4. **优势分析**：求职者相对于该岗位的核心竞争力
5. **改进建议**：针对不匹配项，给出具体的学习和补充建议
6. **行动清单**：按优先级排序的建议学习路径`;return await y([{role:"system",content:w(e)},{role:"user",content:n}],{maxTokens:3e3,temperature:.3})}export{_ as a,w as b,y as c,O as d,P as e,$ as g};
