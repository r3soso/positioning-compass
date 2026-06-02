/* ===== 历史记录管理 UI ===== */

function showHistory() {
  const history = getHistory();
  const reportSection = document.getElementById('reportSection');

  if (history.length === 0) {
    reportSection.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon">📭</div>
        <h3>暂无历史报告</h3>
        <p style="color:var(--text2);margin-top:6px;">完成一次定位分析后，报告会自动保存到这里</p>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="resetAll()">🔄 返回首页</button>
      </div>
    `;
    reportSection.classList.add('show');
    document.getElementById('qaArea').style.display = 'none';
    return;
  }

  reportSection.innerHTML = `
    <div class="report-header">
      <span class="report-icon">📋</span>
      <h2>历史分析报告</h2>
      <p>共 ${history.length} 条记录 · 数据保存在浏览器本地</p>
    </div>
    <div class="history-list">
      ${history.map(h => `
        <div class="history-item" onclick="viewHistoryReport('${h.id}')">
          <div class="hi-date">${formatDate(h.timestamp)}</div>
          <div class="hi-role">${h.roleLabel || '未知角色'} 视角 ${h.isFavorite ? '⭐' : ''}</div>
          <div class="hi-preview">${escapeHtml(h.analysis?.slotSentence || h.analysis?.analysisSummary || '查看详情')}</div>
          <div class="history-actions">
            <span style="font-size:11px;color:var(--text2);">${h.analysis?.source === 'ai' ? '🤖 AI分析' : '📝 离线分析'}</span>
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 12px;margin-left:auto;" onclick="event.stopPropagation();toggleFavoriteHistory('${h.id}')">
              ${h.isFavorite ? '⭐ 取消收藏' : '☆ 收藏'}
            </button>
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 12px;color:var(--red);" onclick="event.stopPropagation();deleteHistoryReport('${h.id}')">
              🗑️
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:20px;">
      <button class="btn btn-primary" onclick="resetAll()">🔄 新建分析</button>
      ${history.length > 0 ? `<button class="btn btn-ghost" style="color:var(--red);" onclick="clearAllHistory()">清空全部历史</button>` : ''}
    </div>
  `;

  reportSection.classList.add('show');
  document.getElementById('qaArea').style.display = 'none';
}

function viewHistoryReport(id) {
  const entry = getHistoryById(id);
  if (!entry) {
    showToast('报告不存在或已被删除', 'error');
    return;
  }

  // 恢复state以便渲染
  state.role = entry.role;
  state.answers = entry.answers || {};
  state.followups = entry.followups || {};
  state.crossAnswers = entry.crossAnswers || {};

  const report = document.getElementById('reportSection');
  report.innerHTML = buildReportHTML(entry.analysis);
  report.classList.add('show');
  document.getElementById('qaArea').style.display = 'none';

  // 添加返回历史列表按钮
  const exportRow = report.querySelector('.export-row');
  if (exportRow) {
    exportRow.insertAdjacentHTML('beforeend',
      '<button class="btn btn-ghost" onclick="showHistory()">📋 返回列表</button>');
  }
}

function deleteHistoryReport(id) {
  if (confirm('确定要删除这份报告吗？此操作不可撤销。')) {
    deleteHistory(id);
    showToast('已删除', 'info');
    showHistory(); // 刷新列表
  }
}

function toggleFavoriteHistory(id) {
  const isFav = toggleFavorite(id);
  showToast(isFav ? '已收藏 ⭐' : '已取消收藏', 'info');
  showHistory(); // 刷新列表
}

function clearAllHistory() {
  if (confirm('确定要清空所有历史报告吗？此操作不可撤销。')) {
    clearHistory();
    showToast('已清空全部历史', 'info');
    resetAll();
  }
}
