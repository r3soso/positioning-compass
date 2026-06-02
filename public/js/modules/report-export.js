/* ===== 报告导出（PNG图片） ===== */

let html2canvasLoaded = false;

function loadHtml2canvas() {
  return new Promise((resolve, reject) => {
    if (html2canvasLoaded && window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }
    if (window.html2canvas) {
      html2canvasLoaded = true;
      resolve(window.html2canvas);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = () => {
      html2canvasLoaded = true;
      resolve(window.html2canvas);
    };
    script.onerror = () => reject(new Error('html2canvas加载失败'));
    document.head.appendChild(script);
  });
}

async function exportReportAsImage() {
  const reportSection = document.getElementById('reportSection');
  if (!reportSection || !reportSection.classList.contains('show')) {
    showToast('请先生成报告', 'error');
    return;
  }

  showToast('📸 正在生成图片...', 'info');

  try {
    const html2canvas = await loadHtml2canvas();

    // 临时隐藏导出按钮（不导出按钮）
    const exportRow = reportSection.querySelector('.export-row');
    if (exportRow) exportRow.style.display = 'none';

    const canvas = await html2canvas(reportSection, {
      backgroundColor: '#f5f3f0',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // 恢复按钮
    if (exportRow) exportRow.style.display = '';

    // 触发下载
    const link = document.createElement('a');
    link.download = '定位分析报告_' + formatDate(Date.now(), 'YYYYMMDD_HHmm') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('✅ 报告已导出为PNG图片', 'success');
  } catch (e) {
    console.error('导出失败:', e);
    showToast('导出失败：' + e.message + '，请尝试使用"打印报告"功能', 'error');
  }
}

// ── 全局 Toast ──

function showToast(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
