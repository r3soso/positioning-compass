// GET /admin — 管理后台页面
// 作为 Function 返回，绕过 Cloudflare Pages 子目录 index.html 的 SPA fallback 问题

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>定位罗盘 · 管理后台</title>
<style>
:root{--bg:#f5f3f0;--card:#fff;--text:#2c2416;--text2:#6b5e4a;--gold:#b8860b;--blue:#2980b9;--red:#c0392b;--green:#27ae60;--border:#e0d8cc;--radius:10px;--shadow:0 2px 16px rgba(0,0,0,0.06);--font:'PingFang SC','Microsoft YaHei',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6}
.container{max-width:960px;margin:0 auto;padding:16px}
.login-box{max-width:360px;margin:80px auto;background:var(--card);padding:40px 32px;border-radius:var(--radius);box-shadow:var(--shadow);text-align:center}
.login-box h1{font-size:22px;margin-bottom:6px}
.login-box p{color:var(--text2);font-size:13px;margin-bottom:24px}
.login-box input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:8px;font-size:16px;font-family:inherit;outline:none;transition:border-color .2s}
.login-box input:focus{border-color:var(--blue)}
.login-box button{margin-top:16px;width:100%;padding:12px;background:var(--text);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.login-box button:hover{background:#4a3e2c}
.login-error{color:var(--red);font-size:13px;margin-top:12px;display:none}
.header{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--border);margin-bottom:20px;flex-wrap:wrap;gap:12px}
.header h1{font-size:18px}
.header a{color:var(--blue);text-decoration:none;font-size:13px}
.header a:hover{text-decoration:underline}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.stat-card{background:var(--card);padding:16px 20px;border-radius:var(--radius);box-shadow:var(--shadow);text-align:center}
.stat-card .stat-num{font-size:28px;font-weight:800;color:var(--gold)}
.stat-card .stat-label{font-size:12px;color:var(--text2);margin-top:2px}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.toolbar span{font-size:13px;color:var(--text2)}
.report-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.report-item{background:var(--card);padding:16px 20px;border-radius:var(--radius);box-shadow:var(--shadow);cursor:pointer;transition:transform .1s;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.report-item:hover{transform:translateY(-1px)}
.report-main{flex:1;min-width:0}
.report-main .ri-date{font-size:11px;color:var(--text2);margin-bottom:4px}
.report-main .ri-role{font-size:12px;font-weight:700;margin-bottom:4px}
.report-main .ri-slot{font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.report-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.tag{font-size:11px;padding:3px 8px;border-radius:10px;font-weight:600}
.tag-ai{background:rgba(41,128,185,0.1);color:var(--blue)}
.tag-local{background:rgba(0,0,0,0.06);color:var(--text2)}
.tag-strong{background:rgba(39,174,96,0.1);color:var(--green)}
.tag-medium{background:rgba(184,134,11,0.1);color:var(--gold)}
.tag-weak{background:rgba(192,57,43,0.08);color:var(--red)}
.del-btn{background:none;border:1px solid var(--border);color:var(--red);font-size:11px;padding:4px 12px;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .2s}
.del-btn:hover{background:var(--red);color:#fff;border-color:var(--red)}
.pagination{display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:20px}
.pagination button{padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--card);cursor:pointer;font-family:inherit;font-size:13px;transition:all .2s}
.pagination button:hover:not(:disabled){background:var(--text);color:#fff;border-color:var(--text)}
.pagination button:disabled{opacity:.3;cursor:default}
.pagination span{font-size:13px;color:var(--text2)}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100;justify-content:center;align-items:flex-start;padding:20px;overflow-y:auto}
.modal-overlay.show{display:flex}
.modal{background:var(--card);border-radius:var(--radius);max-width:720px;width:100%;margin:20px auto;padding:28px 24px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.15)}
.modal-close{position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:var(--text2);line-height:1}
.modal h3{font-size:16px;margin:16px 0 8px;color:var(--text)}
.modal h3:first-child{margin-top:0}
.modal p,.modal li{font-size:14px;color:var(--text2);line-height:1.7}
.modal .highlight{font-size:16px;font-weight:700;color:var(--text);padding:12px;background:var(--bg);border-radius:8px;margin:8px 0}
.modal .tags{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.modal .tag-item{padding:4px 12px;background:rgba(0,0,0,0.05);border-radius:12px;font-size:13px}
.empty{text-align:center;padding:60px 20px;color:var(--text2)}
.loading{text-align:center;padding:40px;color:var(--text2)}
@media(max-width:600px){.stats{grid-template-columns:1fr 1fr}.report-item{flex-direction:column}.header{flex-direction:column;align-items:flex-start}.modal{padding:20px 16px}}
</style>
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
<script>
var PWD='',CP=1,LIM=20;
function login(){var p=document.getElementById('passwordInput').value.trim();if(!p)return;PWD=p;sessionStorage.setItem('admpwd',p);document.getElementById('loginError').style.display='none';loadDash()}
function logout(){PWD='';sessionStorage.removeItem('admpwd');document.getElementById('dashboard').style.display='none';document.getElementById('loginPage').style.display='';document.getElementById('passwordInput').value='';document.getElementById('passwordInput').focus()}
(function(){var s=sessionStorage.getItem('admpwd');if(s){PWD=s;loadDash()}})();
async function loadDash(){document.getElementById('loginPage').style.display='none';document.getElementById('dashboard').style.display='';var r=await fetch('/api/list-reports?password='+encodeURIComponent(PWD)+'&page=1&limit='+LIM);if(r.status===401){logout();document.getElementById('loginError').style.display='block';return}var d=await r.json();if(d.error){alert(d.message);return}renderStats(d);renderList(d);renderPgn(d);document.getElementById('reportCount').textContent='共 '+d.total+' 条报告'}
function renderStats(d){var s=document.getElementById('stats'),ai=d.reports.filter(function(r){return r.source==='ai'}).length,roles={};d.reports.forEach(function(r){roles[r.role_label]=(roles[r.role_label]||0)+1});var topR=Object.entries(roles).sort(function(a,b){return b[1]-a[1]})[0];s.innerHTML='<div class="stat-card"><div class="stat-num">'+d.total+'</div><div class="stat-label">📊 总报告数</div></div><div class="stat-card"><div class="stat-num">'+ai+'</div><div class="stat-label">🤖 AI 分析</div></div><div class="stat-card"><div class="stat-num">'+(d.total-ai)+'</div><div class="stat-label">📝 离线分析</div></div><div class="stat-card"><div class="stat-num">'+(topR?topR[1]:0)+'</div><div class="stat-label">👤 最多角色: '+(topR?topR[0]:'-')+'</div></div>'+(Object.keys(roles).length>=2?'<div class="stat-card"><div class="stat-num">'+Object.keys(roles).length+'</div><div class="stat-label">🎭 角色种类</div></div>':'')}
function renderList(d){var l=document.getElementById('reportList');if(!d.reports.length){l.innerHTML='<div class="empty">📭 暂无报告数据</div>';document.getElementById('toolbarInfo').textContent='';return}var sm={'强':'tag-strong','中等':'tag-medium','弱':'tag-weak'};l.innerHTML=d.reports.map(function(r){return'<div class="report-item" onclick="viewDet(\''+r.id+'\')"><div class="report-main"><div class="ri-date">'+fmtDate(r.created_at)+'</div><div class="ri-role">'+esc(r.role_label||r.role)+' 视角 · '+(r.answer_count||0)+'个回答</div><div class="ri-slot">'+esc(r.slot_sentence||r.category_fit||'未生成定位语句')+'</div></div><div class="report-tags"><span class="tag '+(r.source==='ai'?'tag-ai':'tag-local')+'">'+(r.source==='ai'?'🤖 AI':'📝 离线')+'</span>'+(r.positioning_strength?'<span class="tag '+(sm[r.positioning_strength]||'')+'">'+r.positioning_strength+'</span>':'')+'<button class="del-btn" onclick="event.stopPropagation();delRpt(\''+r.id+'\')">🗑️</button></div></div>'}).join('');document.getElementById('toolbarInfo').textContent='第 '+d.page+'/'+d.totalPages+' 页 · 显示 '+d.reports.length+' 条'}
function renderPgn(d){var p=document.getElementById('pagination');if(d.totalPages<=1){p.innerHTML='';return}var h='';h+='<button '+(d.page<=1?'disabled':'')+' onclick="goPage('+(d.page-1)+')">← 上一页</button>';h+='<span>'+d.page+' / '+d.totalPages+'</span>';h+='<button '+(d.page>=d.totalPages?'disabled':'')+' onclick="goPage('+(d.page+1)+')">下一页 →</button>';p.innerHTML=h;CP=d.page}
async function goPage(n){CP=n;var r=await fetch('/api/list-reports?password='+encodeURIComponent(PWD)+'&page='+n+'&limit='+LIM);var d=await r.json();if(d.error){alert(d.message);return}renderList(d);renderPgn(d);document.getElementById('reportCount').textContent='共 '+d.total+' 条报告'}
async function refreshList(){await loadDash()}
async function viewDet(id){var o=document.getElementById('modalOverlay'),c=document.getElementById('modalContent');c.innerHTML='<div class="loading">⏳ 加载中...</div>';o.classList.add('show');var r=await fetch('/api/report-detail?id='+id+'&password='+encodeURIComponent(PWD));var d=await r.json();if(d.error){c.innerHTML='<p>❌ '+d.message+'</p>';return}var rp=d.report,sm={'强':'tag-strong','中等':'tag-medium','弱':'tag-weak'};c.innerHTML='<button class="modal-close" onclick="closeModal()">✕</button><p style="font-size:11px;color:var(--text2)">'+fmtDate(rp.created_at)+' · '+esc(rp.role_label)+' 视角 · '+(rp.answer_count||0)+'个回答</p><h3>📍 品牌定位语句</h3><div class="highlight">'+esc(rp.slot_sentence||'未填写')+'</div>'+(rp.positioning_strength?'<span class="tag '+(sm[rp.positioning_strength]||'')+'" style="margin-bottom:12px;display:inline-block">定位强度：'+rp.positioning_strength+'</span>':'')+(rp.miss_element?'<h3>🔑 不可替代性</h3><p>'+esc(rp.miss_element)+'</p>':'')+(rp.category_fit?'<h3>📂 品类定位</h3><p>'+esc(rp.category_fit)+'</p>':'')+(rp.usps&&rp.usps.length?'<h3>⚡ 核心卖点</h3><ul>'+rp.usps.map(function(u){return'<li><strong>'+esc(u.type)+'：</strong>'+esc(u.content)+'</li>'}).join('')+'</ul>':'')+(rp.keywords&&rp.keywords.length?'<h3>🏷️ 关键词</h3><div class="tags">'+rp.keywords.map(function(k){return'<span class="tag-item">'+esc(k)+'</span>'}).join('')+'</div>':'')+(rp.competitors&&rp.competitors.length?'<h3>⚔️ 竞品</h3><div class="tags">'+rp.competitors.map(function(c){return'<span class="tag-item">'+esc(c)+'</span>'}).join('')+'</div>':'')+(rp.taglines&&rp.taglines.length?'<h3>📣 宣传语候选</h3><ul>'+rp.taglines.map(function(t){return'<li>'+esc(t)+'</li>'}).join('')+'</ul>':'')+(rp.differentiators&&rp.differentiators.length?'<h3>🎯 差异化点</h3><ul>'+rp.differentiators.map(function(d){return'<li>'+esc(d)+'</li>'}).join('')+'</ul>':'')+(rp.painPoints&&rp.painPoints.length?'<h3>💢 客户痛点</h3><ul>'+rp.painPoints.map(function(p){return'<li>'+esc(p)+'</li>'}).join('')+'</ul>':'')+(rp.triggers&&rp.triggers.length?'<h3>🔔 购买触发点</h3><ul>'+rp.triggers.map(function(t){return'<li>'+esc(t)+'</li>'}).join('')+'</ul>':'')+(rp.analysis_summary?'<h3>🧠 综合分析</h3><p>'+esc(rp.analysis_summary)+'</p>':'')+(rp.nextSteps&&rp.nextSteps.length?'<h3>🚀 行动建议</h3><ol>'+rp.nextSteps.map(function(s){return'<li>'+esc(s)+'</li>'}).join('')+'</ol>':'')+'<h3>📝 原始回答</h3>'+(rp.answers&&Object.keys(rp.answers).length?Object.entries(rp.answers).filter(function(e){return e[1]}).map(function(e){return'<p><strong>'+esc(e[0])+'：</strong>'+esc(e[1])+'</p>'}).join(''):'<p style="color:var(--text2)">无</p>')+(rp.followups&&Object.keys(rp.followups).length?'<p style="margin-top:8px;font-size:12px;color:var(--text2)">追问：</p>'+Object.entries(rp.followups).filter(function(e){return e[1]}).map(function(e){return'<p><strong>'+esc(e[0])+'：</strong>'+esc(e[1])+'</p>'}).join(''):'')+(rp.crossAnswers&&Object.keys(rp.crossAnswers).length?'<p style="margin-top:8px;font-size:12px;color:var(--text2)">交叉审视：</p>'+Object.entries(rp.crossAnswers).filter(function(e){return e[1]}).map(function(e){return'<p><strong>'+esc(e[0])+'：</strong>'+esc(e[1])+'</p>'}).join(''):'')+'<div style="margin-top:24px;text-align:right;border-top:1px solid var(--border);padding-top:16px"><button class="del-btn" onclick="delRpt(\''+rp.id+'\');closeModal()">🗑️ 删除此报告</button></div>'}
function closeModal(){document.getElementById('modalOverlay').classList.remove('show')}
async function delRpt(id){if(!confirm('确定删除？'))return;var r=await fetch('/api/delete-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,password:PWD})});var d=await r.json();if(d.ok){refreshList()}else{alert(d.message||'删除失败')}}
function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmtDate(ts){if(!ts)return'';var d=new Date(ts),p=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())}
</script>
</body>
</html>`;

export async function onRequest(context) {
  return new Response(ADMIN_HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
