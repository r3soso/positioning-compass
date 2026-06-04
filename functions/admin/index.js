// GET /admin — 管理后台页面
export async function onRequest() {
  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>定位罗盘 · 管理后台</title>
<link rel="stylesheet" href="/admin/admin.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>

<div id="loginPage" class="login-box">
  <h1>🎯 定位罗盘</h1>
  <p>管理后台 · 查看所有分析报告</p>
  <input type="password" id="passwordInput" placeholder="请输入管理密码" autofocus onkeydown="if(event.key==='Enter')login()">
  <button onclick="login()">进入后台</button>
  <div class="login-error" id="loginError">密码错误，请重试</div>
</div>

<div id="dashboard" style="display:none">
  <div class="container">
    <div class="header">
      <h1>🎯 定位罗盘 · 管理后台</h1>
      <div style="display:flex;gap:12px;align-items:center">
        <span style="font-size:12px;color:var(--text2)" id="reportCount"></span>
        <a href="/">← 返回首页</a>
        <a href="#" onclick="logout()" style="color:var(--red)">退出</a>
      </div>
    </div>
    <div class="stats" id="stats"></div>
    <div class="charts-row" id="chartsRow" style="display:none">
      <div class="chart-box"><canvas id="chartStrength"></canvas></div>
      <div class="chart-box"><canvas id="chartRoles"></canvas></div>
    </div>
    <div class="charts-row2" id="chartsRow2" style="display:none">
      <div class="chart-box chart-wide"><canvas id="chartDaily"></canvas></div>
    </div>
    <div class="toolbar">
      <span id="toolbarInfo"></span>
      <button class="del-btn" style="color:var(--text2);border-color:var(--border)" onclick="refreshList()">🔄 刷新</button>
    </div>
    <div id="reportList"></div>
    <div class="pagination" id="pagination"></div>
  </div>
</div>

<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modalContent"></div>
</div>

<script src="/admin/admin.js"></script>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
