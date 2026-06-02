/* ===== 报告渲染器 ===== */

function buildReportHTML(analysis) {
  const isAI = analysis.source === 'ai';
  const bestTag = analysis.taglines?.[0] || '';
  const strength = analysis.positioningStrength || '中等';
  const strengthMap = { '强': 'strong', '中等': 'medium', '弱': 'weak' };

  return `
    <div class="report-header">
      <span class="report-icon">🎯</span>
      <h2>定位分析报告 ${isAI ? '<span style="font-size:10px;color:var(--blue);background:rgba(41,128,185,0.08);padding:3px 8px;border-radius:10px;">AI深度分析</span>' : '<span class="offline-badge"><span class="offline-dot"></span>离线模式</span>'}</h2>
      <p>基于${analysis.roleLabel}视角 · 已回答${analysis.answerCount}个问题 · ${isAI ? 'AI智能提炼' : '本地关键词分析'}</p>
    </div>

    <!-- 定位语句 -->
    <div class="report-card">
      <h3>📍 品牌定位语句</h3>
      <p style="font-size:12px;color:var(--text2);margin-bottom:10px;">
        特劳特定位公式：品牌 = 品类 + 差异化特性
        ${analysis.positioningStrength ? `<span class="strength-badge ${strengthMap[strength] || 'medium'}">定位强度：${strength}</span>` : ''}
      </p>
      <div class="highlight">${escapeHtml(analysis.slotSentence || '')}</div>
      <p style="font-size:12px;color:var(--text2);margin-top:8px;">💡 这是你的"语言钉"——在所有传播中保持一致，反复捶打，直到它钉入顾客心智。</p>
    </div>

    <!-- 不可替代性 -->
    <div class="report-card">
      <h3>🔑 品牌不可替代性</h3>
      <p style="font-size:13px;color:var(--text2);margin-bottom:8px;">如果品牌消失，顾客会想念什么？</p>
      <p style="font-size:15px;line-height:1.8;padding:12px;background:#fafaf8;border-radius:8px;">${escapeHtml(analysis.missElement || '')}</p>
    </div>

    <!-- 品类适配 -->
    ${analysis.categoryFit ? `
    <div class="report-card">
      <h3>📂 品类定位建议</h3>
      <p style="font-size:14px;line-height:1.8;padding:12px;background:#fafaf8;border-radius:8px;">${escapeHtml(analysis.categoryFit)}</p>
    </div>` : ''}

    <!-- 核心卖点 -->
    <div class="report-card">
      <h3>⚡ 核心卖点提炼</h3>
      <ul class="usp-list">
        ${(analysis.usps || []).map(u => `
          <li><strong>${escapeHtml(u.type)}：</strong>${escapeHtml(u.content)}</li>
        `).join('')}
      </ul>
    </div>

    <!-- 关键词云 -->
    <div class="report-card">
      <h3>🏷️ 品牌关键词</h3>
      <div class="keyword-cloud">
        ${(analysis.keywords || []).map(k => `
          <span class="keyword-tag">${escapeHtml(k)}</span>
        `).join('')}
      </div>
    </div>

    <!-- 竞品分析 -->
    ${analysis.competitors?.length ? `
    <div class="report-card">
      <h3>⚔️ 竞品格局</h3>
      <div style="font-size:13px;color:var(--text2);margin-top:6px;">
        ${analysis.competitors.map(c => `<span style="display:inline-block;padding:4px 12px;margin:3px;background:#f0f0f0;border-radius:12px;">${escapeHtml(c)}</span>`).join('')}
      </div>
    </div>` : ''}

    <!-- AI分析总结 -->
    ${analysis.analysisSummary ? `
    <div class="report-card">
      <h3>🧠 综合分析</h3>
      <div class="ai-summary">${escapeHtml(analysis.analysisSummary)}</div>
    </div>` : ''}

    <!-- 宣传语候选 -->
    <div class="report-card">
      <h3>📣 宣传语候选（请选择最能打动你的）</h3>
      <div class="tagline-candidates">
        ${(analysis.taglines || []).map((t, i) => `
          <div class="tagline-card ${i === 0 ? 'best' : ''}" onclick="selectTagline('${escapeHtml(t).replace(/'/g, "\\'")}', this)">
            ${escapeHtml(t)}
          </div>
        `).join('')}
      </div>
      <p style="font-size:11px;color:var(--text2);margin-top:12px;text-align:center;">👆 点击你最喜欢的宣传语，自动复制到剪贴板</p>
    </div>

    <!-- 导出按钮 -->
    <div class="export-row">
      <button class="btn btn-primary" onclick="exportReportAsImage()">📸 导出为图片</button>
      <button class="btn btn-secondary" onclick="window.print()">🖨️ 打印报告</button>
      <button class="btn btn-ghost" onclick="resetAll()">🔄 重新分析</button>
      <button class="btn btn-ghost" onclick="showHistory()">📋 查看历史</button>
    </div>

    <!-- 下一步 -->
    <div class="report-card next-steps-card">
      <h3>🚀 下一步行动建议</h3>
      <ol class="next-steps-list">
        ${(analysis.nextSteps || []).map((s, i) => `<li>${i + 1}. <strong>${escapeHtml(s)}</strong></li>`).join('')}
      </ol>
    </div>

    <div class="report-footer">
      基于特劳特《定位》理论 · ${isAI ? 'DeepSeek AI智能分析' : '本地关键词分析'} · 仅供内部参考
    </div>
  `;
}

function selectTagline(tagline, el) {
  document.querySelectorAll('.tagline-card').forEach(c => c.classList.remove('best'));
  el.classList.add('best');
  navigator.clipboard?.writeText(tagline).then(() => {
    showToast('✅ 已复制：' + tagline, 'success');
  }).catch(() => {});
}
