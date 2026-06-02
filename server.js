require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8899;

// ── 安全与解析中间件 ──
app.use(helmet({
  contentSecurityPolicy: false, // 允许加载CDN脚本(html2canvas等)
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 上传临时目录
const uploadDir = path.join(__dirname, 'uploads');
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

// ── DeepSeek API 调用封装 ──
async function callDeepSeek(systemPrompt, userMessage, temperature = 0.7) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }

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
    const { role, roleLabel, answers, followups, crossAnswers } = req.body;

    if (!role || !answers) {
      return res.status(400).json({ error: true, message: '缺少必要参数' });
    }

    // 构建用户问答文本
    let qaText = `角色：${roleLabel || role}\n\n`;
    if (answers) {
      Object.entries(answers).forEach(([field, text]) => {
        qaText += `问题(${field})：${text}\n`;
      });
    }
    if (followups) {
      Object.entries(followups).forEach(([field, text]) => {
        qaText += `追问(${field})：${text}\n`;
      });
    }
    if (crossAnswers) {
      Object.entries(crossAnswers).forEach(([field, text]) => {
        qaText += `交叉问题(${field})：${text}\n`;
      });
    }

    const systemPrompt = `你是一位特劳特定位理论的资深品牌顾问，精通《定位》《商战》《与众不同》等经典著作。
你的任务是基于用户（一位品牌团队成员）的问答记录，进行专业的品牌定位分析。

请严格按以下JSON格式返回分析结果（不要添加任何额外文字，不要用markdown代码块包裹）：
{
  "slotSentence": "品牌定位语句（格式：品牌名 = 品类 + 差异化特性，例如：沃尔沃=安全的汽车）",
  "missElement": "如果品牌消失，顾客最想念什么（50字以内）",
  "usps": [
    {"type": "差异化优势|购买驱动|客户价值|核心优势", "content": "具体卖点描述"}
  ],
  "keywords": ["品牌核心关键词1", "关键词2"],
  "taglines": ["宣传语候选1（4-20字）", "候选2"],
  "competitors": ["竞品1", "竞品2"],
  "differentiators": ["差异化点1", "差异化点2"],
  "painPoints": ["客户痛点1", "痛点2"],
  "triggers": ["购买决策触发点1"],
  "nextSteps": ["行动建议1", "建议2", "建议3", "建议4", "建议5"],
  "analysisSummary": "200字以内的综合分析概述",
  "positioningStrength": "强|中等|弱",
  "categoryFit": "品牌所属品类的定位建议（30字以内）"
}

分析原则：
1. 严格遵循特劳特定位理论：心智阶梯、差异化、聚焦法则、语言钉
2. 基于用户的实际回答进行分析，不要编造信息
3. 宣传语要短小精悍、一针见血，最好能成为"语言钉"
4. 如果用户的回答不够充分，在对应字段填写"需要更多信息来准确判断"
5. 关键词应反映品牌的核心定位概念，而非泛泛的形容词
6. 所有输出使用中文`;

    const content = await callDeepSeek(systemPrompt, qaText, 0.7);

    // 解析AI返回的JSON
    let analysis;
    try {
      // 尝试清理可能的markdown包裹
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('AI返回JSON解析失败:', parseErr.message);
      console.error('原始内容:', content);
      return res.status(500).json({
        error: true,
        code: 'PARSE_ERROR',
        message: 'AI分析结果解析失败，请重试',
        rawContent: content,
      });
    }

    res.json({ error: false, ...analysis });
  } catch (err) {
    console.error('/api/analyze 错误:', err.message);
    res.status(503).json({
      error: true,
      code: err.message.includes('超时') ? 'TIMEOUT' : 'AI_UNAVAILABLE',
      message: 'AI分析服务暂时不可用：' + err.message,
    });
  }
});

// ── API: 智能追问生成 ──
app.post('/api/generate-followup', analyzeLimiter, async (req, res) => {
  try {
    const { role, roleLabel, originalQuestion, userAnswer, previousFollowup } = req.body;

    if (!userAnswer) {
      return res.status(400).json({ error: true, message: '缺少用户回答' });
    }

    const systemPrompt = `你是一位特劳特定位理论的资深访谈顾问。你的任务是根据用户的原始回答，生成一个深度追问。

要求：
1. 追问必须基于用户的具体回答内容，而非模板化问题
2. 追问应引导用户更具体地描述品牌差异化、顾客认知或竞争格局
3. 追问中可适当引入特劳特定位理论的概念（如心智阶梯、语言钉、视觉锤等）
4. 追问应简短有力（30-60字）
5. 同时提供一个15字以内的简短提示

请严格按以下JSON格式返回（不要添加任何额外文字）：
{ "question": "追问内容（30-60字）", "hint": "简短提示（15字以内）" }`;

    const userMessage = `角色：${roleLabel || role}\n原始问题：${originalQuestion}\n用户回答：${userAnswer}\n${previousFollowup ? '上一轮追问：' + previousFollowup : ''}`;

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
    console.error('/api/generate-followup 错误:', err.message);
    res.status(503).json({ error: true, message: '追问生成服务暂时不可用' });
  }
});

// ── API: 语音转写 ──
app.post('/api/voice/transcribe', voiceLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: '未收到音频文件' });
    }

    const audioPath = req.file.path;
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = audioBuffer.toString('base64');

    // 优先使用 DeepSeek 兼容的音频转写（如果支持），否则回退到文本提示
    // 注意：DeepSeek目前没有原生audio endpoint，这里使用OpenAI Whisper API
    const whisperKey = process.env.WHISPER_API_KEY;
    if (!whisperKey) {
      // 没有Whisper API Key时，返回提示让前端使用Web Speech结果
      fs.unlinkSync(audioPath); // 清理临时文件
      return res.json({
        error: false,
        text: '',
        fallback: true,
        message: '语音转写服务未配置，使用浏览器内置识别结果',
      });
    }

    // 调用 OpenAI Whisper API
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

    // 清理临时文件
    fs.unlinkSync(audioPath);

    if (!whisperResp.ok) {
      const errText = await whisperResp.text().catch(() => '');
      console.error('Whisper API 错误:', whisperResp.status, errText);
      return res.json({
        error: false,
        text: '',
        fallback: true,
        message: '语音转写失败，使用浏览器内置识别结果',
      });
    }

    const whisperData = await whisperResp.json();
    res.json({
      error: false,
      text: whisperData.text || '',
      fallback: false,
    });
  } catch (err) {
    console.error('/api/voice/transcribe 错误:', err.message);
    // 清理可能残留的临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.json({
      error: false,
      text: '',
      fallback: true,
      message: '语音转写服务异常，使用浏览器内置识别结果',
    });
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

// ── SPA 回退: 所有非API路由返回 index.html ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: true, message: 'API端点不存在' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 错误处理 ──
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: true, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🎯 定位罗盘服务已启动: http://localhost:${PORT}`);
  console.log(`   AI分析: ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '⚠️ 未配置（使用离线模式）'}`);
  console.log(`   语音转写: ${process.env.WHISPER_API_KEY ? '✅ 已配置' : '⚠️ 未配置（使用浏览器内置识别）'}`);
});
