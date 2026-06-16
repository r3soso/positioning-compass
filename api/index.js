// Vercel Serverless Function — 适配 Express 应用
// 将 Express app 导出为 Vercel 兼容的 serverless handler

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// ── 安全与解析中间件 ──
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 静态文件服务（Vercel 上由 CDN 直接提供，这里作为回退）
app.use(express.static(path.join(__dirname, '..', 'public')));

// 上传临时目录（Vercel 用 /tmp）
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });

// ── 限流 ──
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: true, code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
});
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: true, code: 'RATE_LIMITED', message: '语音请求过于频繁，请稍后再试' },
});

// ── DeepSeek API 调用 ──
async function callDeepSeek(systemPrompt, userMessage, temperature = 0.7) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`DeepSeek API 返回错误 ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ── API: 定位分析 ──
app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  try {
    const { role, roleLabel, answers } = req.body;
    if (!role || !answers) {
      return res.status(400).json({ error: true, message: '缺少必要参数' });
    }

    let qaText = `角色：${roleLabel || role}\n\n`;
    if (answers) {
      Object.entries(answers).forEach(([field, text]) => {
        qaText += `问题(${field})：${text}\n`;
      });
    }

    const systemPrompt = `你是一位资深品牌战略顾问，帮助品牌团队分析来自一线团队的调研问卷。

你的任务是基于用户（一位品牌团队成员）的问答记录，提炼品牌的核心优势、竞争洞察和改进建议。

请严格按以下JSON格式返回分析结果（不要添加任何额外文字，不要用markdown代码块包裹）：
{
  "slotSentence": "品牌定位语句（格式：品牌名 = 品类 + 差异化特性）",
  "missElement": "如果品牌消失，顾客最想念什么（50字以内）",
  "usps": [{"type": "差异化优势|购买驱动|客户价值|核心优势", "content": "具体卖点描述"}],
  "keywords": ["品牌核心关键词"],
  "taglines": ["宣传语候选（4-20字）"],
  "competitors": ["竞品"],
  "differentiators": ["差异化点"],
  "painPoints": ["客户痛点"],
  "triggers": ["购买决策触发点"],
  "nextSteps": ["行动建议"],
  "analysisSummary": "200字以内的综合分析概述",
  "positioningStrength": "强|中等|弱",
  "categoryFit": "品牌所属品类的定位建议（30字以内）"
}

分析原则：
1. 基于用户实际回答，如实提炼，不编造信息
2. 关注一线人员反馈的具体细节和原话
3. 洞察跨问题的共性模式和核心矛盾
4. 如果信息不足，填写"需要更多信息来准确判断"
5. 所有输出使用中文`;

    const content = await callDeepSeek(systemPrompt, qaText, 0.7);

    let analysis;
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(500).json({
        error: true, code: 'PARSE_ERROR', message: 'AI分析结果解析失败，请重试', rawContent: content,
      });
    }

    res.json({ error: false, ...analysis });
  } catch (err) {
    console.error('/api/analyze 错误:', err.message);
    res.status(503).json({ error: true, code: 'AI_UNAVAILABLE', message: 'AI分析服务暂时不可用：' + err.message });
  }
});

// ── API: 智能追问 ──
app.post('/api/generate-followup', analyzeLimiter, async (req, res) => {
  try {
    const { role, roleLabel, originalQuestion, userAnswer } = req.body;
    if (!userAnswer) return res.status(400).json({ error: true, message: '缺少用户回答' });

    const systemPrompt = `你是一位特劳特定位理论的资深访谈顾问。根据用户的回答生成深度追问。
请严格按JSON返回：{ "question": "追问内容（30-60字）", "hint": "简短提示（15字以内）" }`;
    const userMessage = `角色：${roleLabel || role}\n原始问题：${originalQuestion}\n用户回答：${userAnswer}`;

    const content = await callDeepSeek(systemPrompt, userMessage, 0.8);
    let followup;
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      followup = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: true, code: 'PARSE_ERROR', message: '追问生成失败' });
    }
    res.json({ error: false, ...followup });
  } catch (err) {
    res.status(503).json({ error: true, message: '追问生成服务暂时不可用' });
  }
});

// ── API: 语音转写 ──
app.post('/api/voice/transcribe', voiceLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: true, message: '未收到音频文件' });

    const audioPath = req.file.path;
    const audioBuffer = fs.readFileSync(audioPath);
    const whisperKey = process.env.WHISPER_API_KEY;

    if (!whisperKey) {
      fs.unlinkSync(audioPath);
      return res.json({ error: false, text: '', fallback: true, message: '语音转写未配置' });
    }

    const formData = new FormData();
    formData.append('model', 'whisper-1');
    formData.append('language', 'zh');
    formData.append('response_format', 'json');
    formData.append('file', new Blob([audioBuffer], { type: req.file.mimetype || 'audio/webm' }), 'audio.webm');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${whisperKey}` },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    fs.unlinkSync(audioPath);

    if (!whisperResp.ok) {
      return res.json({ error: false, text: '', fallback: true, message: '转写失败' });
    }
    const data = await whisperResp.json();
    res.json({ error: false, text: data.text || '', fallback: false });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({ error: false, text: '', fallback: true, message: '转写服务异常' });
  }
});

// ── 健康检查 ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiAvailable: !!process.env.DEEPSEEK_API_KEY,
    whisperAvailable: !!process.env.WHISPER_API_KEY,
  });
});

// ── Vercel serverless 导出 ──
module.exports = app;
