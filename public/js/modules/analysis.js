/* ===== AI分析引擎 + 本地回退 ===== */

// ── 主入口：先生成报告 ──

async function generateReport() {
  saveCurrentAnswer();

  // 隐藏Q&A区域，显示加载态
  const qaArea = document.getElementById('qaArea');
  qaArea.style.display = 'none';

  const report = document.getElementById('reportSection');
  report.classList.add('show');
  report.innerHTML = renderLoadingSkeleton();
  report.scrollIntoView({ behavior: 'smooth' });

  // 尝试AI分析
  let analysis = null;
  try {
    analysis = await analyzeWithAI();
  } catch (e) {
    console.warn('AI分析失败，回退到本地分析:', e.message);
  }

  // 回退到本地分析
  if (!analysis) {
    analysis = analyzePositioningLocal(getAllAnswerText());
  }

  // 渲染报告
  state.report = analysis;
  report.innerHTML = buildReportHTML(analysis);

  // 保存到历史
  saveReportToHistory(analysis);
}

// ── AI 分析 ──

async function analyzeWithAI() {
  const payload = {
    role: state.role,
    roleLabel: getRoleLabel(state.role),
    answers: state.answers,
    followups: state.followups,
    crossAnswers: state.crossAnswers,
  };

  const resp = await fetch(CONFIG.API_BASE + '/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(CONFIG.AI_TIMEOUT),
  });

  if (!resp.ok) {
    throw new Error('AI服务返回错误: ' + resp.status);
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.message || 'AI分析失败');
  }

  return {
    ...data,
    source: 'ai',
    role: state.role,
    roleLabel: getRoleLabel(state.role),
    answerCount: Object.values(state.answers).filter(Boolean).length +
                 Object.values(state.followups).filter(Boolean).length +
                 Object.values(state.crossAnswers).filter(Boolean).length,
  };
}

// ── 本地关键词分析引擎（回退方案）──

function analyzePositioningLocal(allText) {
  const lines = allText.split('\n').filter(l => l.trim().length > 3);

  const keywords = extractKeywords(allText);
  const competitors = extractCompetitors(allText);
  const differentiators = extractDifferentiators(allText);
  const customerPainPoints = extractPainPoints(allText);
  const purchaseTriggers = extractTriggers(allText);

  const slotSentence = state.crossAnswers['slot'] || buildSlotFromKeywords(keywords);
  const missElement = state.crossAnswers['miss'] || buildMissFromData(allText);
  const usps = synthesizeUSPs(allText, differentiators, purchaseTriggers);
  const taglines = generateTaglines(keywords, differentiators, customerPainPoints);

  return {
    source: 'local',
    role: state.role,
    roleLabel: getRoleLabel(state.role),
    keywords,
    competitors,
    differentiators,
    painPoints: customerPainPoints,
    triggers: purchaseTriggers,
    slotSentence,
    missElement,
    usps,
    taglines,
    nextSteps: [
      '将定位语句传达给销售经理、经销商、导购、售后所有环节',
      '基于核心卖点制定各角色的标准话术',
      '用宣传语候选做小范围测试，看哪句最能打动客户',
      '定期收集一线反馈迭代优化定位',
      '换一个角色视角重新做一次问答，会有不同的发现',
    ],
    analysisSummary: '（离线模式生成）基于你的问答记录，我们提取了品牌关键词、差异化优势和客户痛点。建议配合AI分析获得更深入的定位洞察。',
    positioningStrength: '中等',
    categoryFit: '请完成"定位句式"问题以获得更精准的品类定位',
    answerCount: Object.values(state.answers).filter(Boolean).length +
                 Object.values(state.followups).filter(Boolean).length +
                 Object.values(state.crossAnswers).filter(Boolean).length,
  };
}

// ── 关键词提取 ──

function extractKeywords(text) {
  const t = text.toLowerCase();
  const words = text.replace(/[，,。.！!？?\s\n]+/g, ' ').split(' ').filter(w => w.length >= 2 && w.length <= 6);
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
  const stopWords = ['我们', '他们', '一个', '这个', '那个', '什么', '怎么', '为什么', '因为', '所以', '但是', '可以', '能够', '就是', '还是', '如果', '虽然', '不过', '已经', '比较', '非常', '而且'];
  return [...new Set(sorted.filter(w => !stopWords.includes(w) && w.length >= 2))].slice(0, 10);
}

function extractCompetitors(text) {
  const compMatch = text.match(/(?:竞品|对手|竞争|同行|其他品牌|别人|它们?家)[：:\s]*([^。！？\n]{4,40})/g);
  if (compMatch) return compMatch.map(m => m.replace(/(?:竞品|对手|竞争|同行|其他品牌|别人|它们?家)[：:\s]*/, '')).slice(0, 3);
  return ['需进一步明确主要竞品'];
}

function extractDifferentiators(text) {
  const diffMatch = text.match(/(?:不同|差异|优势|独特|唯一|领先|更好|更强|更快|更便宜|更专业)[：:\s]*([^。！？\n]{4,50})/g);
  if (diffMatch) return [...new Set(diffMatch.map(m => m.replace(/(?:不同|差异|优势|独特|唯一|领先|更好|更强|更快|更便宜|更专业)[：:\s]*/, '').trim()))].slice(0, 5);
  return ['根据你的描述，品牌在特定领域具有差异化优势'];
}

function extractPainPoints(text) {
  const painMatch = text.match(/(?:痛点|问题|投诉|后悔|不满意|担心|害怕|犹豫|纠结|困扰)[：:\s]*([^。！？\n]{4,50})/g);
  if (painMatch) return painMatch.map(m => m.replace(/(?:痛点|问题|投诉|后悔|不满意|担心|害怕|犹豫|纠结|困扰)[：:\s]*/, '')).slice(0, 5);
  return ['客户的核心顾虑需要进一步明确'];
}

function extractTriggers(text) {
  const trigMatch = text.match(/(?:买单|下单|决定|选择|买|成交|打动|心动)[：:\s]*([^。！？\n]{4,50})/g);
  if (trigMatch) return trigMatch.map(m => m.replace(/(?:买单|下单|决定|选择|买|成交|打动|心动)[：:\s]*/, '')).slice(0, 5);
  return ['客户的购买决策点需要更多信息来明确'];
}

function buildSlotFromKeywords(keywords) {
  if (keywords.length >= 3) return `${keywords[0]}的${keywords[1]}${keywords[2] || '专家'}`;
  return '请你完成交叉问题中的定位句式，让品牌定位更加精准';
}

function buildMissFromData(text) {
  const snippets = text.split(/[。！？\n]/).filter(s => s.length > 10).slice(0, 3);
  if (snippets.length > 0) return '根据你的回答，客户最可能想念的是：' + snippets[0].substring(0, 40) + '...';
  return '品牌的核心价值需要更清晰地提炼';
}

function synthesizeUSPs(text, differentiators, triggers) {
  const usps = [];
  differentiators.slice(0, 3).forEach(d => {
    if (d && d.length > 5 && d !== '需进一步明确主要竞品') usps.push({ type: '差异化优势', content: d });
  });
  triggers.slice(0, 2).forEach(t => {
    if (t && t.length > 5 && t !== '客户的购买决策点需要更多信息来明确') usps.push({ type: '购买驱动', content: t });
  });
  const valueMatch = text.match(/(?:价值|优势|好处|利益)[：:\s]*([^。！？\n]{4,60})/g);
  if (valueMatch) {
    valueMatch.slice(0, 2).forEach(v => {
      const clean = v.replace(/(?:价值|优势|好处|利益)[：:\s]*/, '').trim();
      if (clean.length > 5) usps.push({ type: '客户价值', content: clean });
    });
  }
  if (usps.length === 0) usps.push({ type: '核心优势', content: '根据你的回答提炼：品牌在解决客户某个具体问题上具有独特的能力，这是构建定位的基础' });
  return usps.slice(0, 6);
}

function generateTaglines(keywords, differentiators, painPoints) {
  const tags = [];
  const kw = keywords.slice(0, 5);
  const diff = differentiators.filter(d => d.length > 5 && d !== '需进一步明确主要竞品').slice(0, 2);
  const pain = painPoints.filter(p => p.length > 5 && p !== '客户的核心顾虑需要进一步明确').slice(0, 1);

  if (kw.length >= 2) tags.push('选' + kw[0] + '，更' + kw[1]);
  if (pain.length > 0) tags.push('不再' + pain[0].substring(0, 8));
  if (kw.length >= 2) tags.push(kw[0] + '行业' + kw[1] + '引领者');
  if (diff.length > 0) tags.push(diff[0].substring(0, 15));
  if (kw.length >= 1) tags.push('让每一个' + kw[0] + '都值得');
  tags.push((kw[0] || '品质') + '，用结果说话');

  return [...new Set(tags.filter(t => t.length >= 4 && t.length <= 20))].slice(0, 6);
}

// ── 加载骨架屏 ──

function renderLoadingSkeleton() {
  return `
    <div class="ai-loading">
      <div class="ai-spinner"></div>
      <p>AI正在深度分析你的回答...</p>
      <p class="ai-tip">基于特劳特定位理论，提炼品牌核心定位</p>
    </div>
    <div class="skeleton-card">
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
    </div>
  `;
}
