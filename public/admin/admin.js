var PWD='',CP=1,LIM=20;

// Auth
function login(){
  var p=document.getElementById('passwordInput').value.trim();
  if(!p)return;
  PWD=p;
  sessionStorage.setItem('admpwd',p);
  document.getElementById('loginError').style.display='none';
  loadDash();
}
function logout(){
  PWD='';
  sessionStorage.removeItem('admpwd');
  document.getElementById('dashboard').style.display='none';
  document.getElementById('loginPage').style.display='';
  document.getElementById('passwordInput').value='';
  document.getElementById('passwordInput').focus();
}

// Auto login
(function(){
  var s=sessionStorage.getItem('admpwd');
  if(s){PWD=s;loadDash();}
})();

// Dashboard
async function loadDash(){
  document.getElementById('loginPage').style.display='none';
  document.getElementById('dashboard').style.display='';
  var r=await fetch('/api/list-reports?password='+encodeURIComponent(PWD)+'&page=1&limit='+LIM);
  if(r.status===401){logout();document.getElementById('loginError').style.display='block';return}
  var d=await r.json();
  if(d.error){alert(d.message);return}
  renderStats(d);
  renderList(d);
  renderPgn(d);
  loadCharts();
  injectSummaryBtn();
  injectProvinceBtn();
  document.getElementById('reportCount').textContent='共 '+d.total+' 条报告';
}

// ── 一键AI总结 ──

function injectSummaryBtn(){
  var old=document.getElementById('summaryBtnRow');
  if(old)old.remove();
  var oldR=document.getElementById('summaryResult');
  if(oldR)oldR.remove();
  var row=document.createElement('div');
  row.id='summaryBtnRow';
  row.style.cssText='margin-bottom:20px;text-align:center';
  row.innerHTML='<button class="sum-btn" onclick="runSummary()">🧠 一键AI总结（按角色分析所有问卷）</button>';
  var stats=document.getElementById('stats');
  stats.parentNode.insertBefore(row,stats.nextSibling);
}

async function runSummary(){
  var btn=document.querySelector('.sum-btn');
  if(!btn)return;
  btn.disabled=true;
  btn.textContent='⏳ AI正在分析各角色问卷，请耐心等待...';
  btn.style.opacity='0.7';

  // 显示结果容器
  var oldR=document.getElementById('summaryResult');
  if(oldR)oldR.remove();
  var container=document.createElement('div');
  container.id='summaryResult';
  container.innerHTML='<div class="loading" style="padding:20px;text-align:center;color:var(--text2)">⏳ 正在读取所有问卷数据并调用AI分析...</div>';
  btn.parentNode.insertBefore(container,btn.nextSibling);

  try{
    var r=await fetch('/api/summary-by-role?password='+encodeURIComponent(PWD));
    if(r.status===401){container.innerHTML='<p style="color:var(--red);text-align:center;padding:20px">❌ 密码错误</p>';return}
    var d=await r.json();
    if(d.error){container.innerHTML='<p style="color:var(--red);text-align:center;padding:20px">❌ '+d.message+'</p>';return}
    renderSummary(d,container);
  }catch(e){
    container.innerHTML='<p style="color:var(--red);text-align:center;padding:20px">❌ 请求失败：'+e.message+'</p>';
  }finally{
    btn.disabled=false;
    btn.textContent='🧠 一键AI总结（按角色分析所有问卷）';
    btn.style.opacity='1';
  }
}

function renderSummary(d,container){
  var s=d.summaries;
  var roles=['manager','dealer','guide','service'];
  var h='';
  h+='<div class="sum-meta">📅 生成时间：'+fmtDate(d.generatedAt)+'</div>';
  h+='<div class="sum-cards">';
  roles.forEach(function(rid){
    var sum=s[rid];
    if(!sum)return;
    h+='<div class="sum-card">';
    h+='<div class="sum-card-hd">';
    h+='<span class="sum-role-icon">'+(sum.icon||'')+'</span>';
    h+='<span class="sum-role-name">'+esc(sum.roleLabel)+'</span>';
    h+='<span class="sum-role-count">'+sum.reportCount+' 份问卷</span>';
    h+='</div>';

    if(sum.note && !sum.summary){
      h+='<div class="sum-card-body"><p style="color:var(--text2)">📭 '+esc(sum.note)+'</p></div>';
    } else if(sum.summary){
      var sm=sum.summary;
      if(sm.parseError){
        h+='<div class="sum-card-body"><p style="color:var(--red)">⚠️ AI返回解析失败，原始内容：</p><pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto">'+esc(sm.raw)+'</pre></div>';
      } else {
        h+='<div class="sum-card-body">';
        // 一句话总结
        if(sm.oneLineSummary){
          h+='<div class="sum-oneline">💬 '+esc(sm.oneLineSummary)+'</div>';
        }
        // 核心发现
        if(sm.coreFindings&&sm.coreFindings.length){
          h+='<div class="sum-section"><div class="sum-section-title">🔍 核心发现</div><ul>';
          sm.coreFindings.forEach(function(f){h+='<li>'+esc(f)+'</li>'});
          h+='</ul></div>';
        }
        // 共性痛点
        if(sm.commonPainPoints&&sm.commonPainPoints.length){
          h+='<div class="sum-section"><div class="sum-section-title">💢 共性痛点</div><ul>';
          sm.commonPainPoints.forEach(function(f){h+='<li>'+esc(f)+'</li>'});
          h+='</ul></div>';
        }
        // 竞争洞察
        if(sm.competitiveInsights&&sm.competitiveInsights.length){
          h+='<div class="sum-section"><div class="sum-section-title">⚔️ 竞争洞察</div><ul>';
          sm.competitiveInsights.forEach(function(f){h+='<li>'+esc(f)+'</li>'});
          h+='</ul></div>';
        }
        // 一线声音
        if(sm.customerVoices&&sm.customerVoices.length){
          h+='<div class="sum-section"><div class="sum-section-title">🗣️ 一线声音</div><ul>';
          sm.customerVoices.forEach(function(f){h+='<li>'+esc(f)+'</li>'});
          h+='</ul></div>';
        }
        // 建议
        if(sm.suggestions&&sm.suggestions.length){
          h+='<div class="sum-section"><div class="sum-section-title">💡 给品牌的建议</div><ul>';
          sm.suggestions.forEach(function(f){h+='<li>'+esc(f)+'</li>'});
          h+='</ul></div>';
        }
        h+='</div>';
      }
    }
    h+='</div>';
  });
  h+='</div>';
  h+='<div style="text-align:center;margin-top:16px"><button class="btn-refresh-sum" onclick="runSummary()">🔄 重新生成总结</button></div>';
  container.innerHTML=h;
}

// Stats
function renderStats(d){
  var s=document.getElementById('stats');
  var ai=d.reports.filter(function(r){return r.source==='ai'}).length;
  var roles={};
  d.reports.forEach(function(r){roles[r.role_label]=(roles[r.role_label]||0)+1});
  var topR=Object.entries(roles).sort(function(a,b){return b[1]-a[1]})[0];
  var h='';
  h+='<div class="stat-card"><div class="stat-num">'+d.total+'</div><div class="stat-label">📊 总报告数</div></div>';
  h+='<div class="stat-card"><div class="stat-num">'+ai+'</div><div class="stat-label">🤖 AI 分析</div></div>';
  h+='<div class="stat-card"><div class="stat-num">'+(d.total-ai)+'</div><div class="stat-label">📝 离线分析</div></div>';
  h+='<div class="stat-card"><div class="stat-num">'+(topR?topR[1]:0)+'</div><div class="stat-label">👤 最多角色: '+(topR?topR[0]:'-')+'</div></div>';
  if(Object.keys(roles).length>=2){
    h+='<div class="stat-card"><div class="stat-num">'+Object.keys(roles).length+'</div><div class="stat-label">🎭 角色种类</div></div>';
  }
  s.innerHTML=h;
}

// List
function renderList(d){
  var l=document.getElementById('reportList');
  if(!d.reports.length){l.innerHTML='<div class="empty">📭 暂无报告数据</div>';document.getElementById('toolbarInfo').textContent='';return}
  var sm={'强':'tag-strong','中等':'tag-medium','弱':'tag-weak'};
  var h='';
  d.reports.forEach(function(r){
    h+='<div class="report-item" onclick="viewDet(\''+r.id+'\')">';
    h+='<div class="report-main">';
    h+='<div class="ri-date">'+fmtDate(r.created_at)+'</div>';
    h+='<div class="ri-role">'+esc(r.role_label||r.role)+' 视角 · '+(r.answer_count||0)+'个回答</div>';
    h+='<div class="ri-slot">'+esc(r.slot_sentence||r.category_fit||'未生成定位语句')+'</div>';
    h+='</div>';
    h+='<div class="report-tags">';
    h+='<span class="tag '+(r.source==='ai'?'tag-ai':'tag-local')+'">'+(r.source==='ai'?'🤖 AI':'📝 离线')+'</span>';
    if(r.positioning_strength)h+='<span class="tag '+(sm[r.positioning_strength]||'')+'">'+r.positioning_strength+'</span>';
    h+='<button class="del-btn" onclick="event.stopPropagation();delRpt(\''+r.id+'\')">🗑️</button>';
    h+='</div></div>';
  });
  l.innerHTML=h;
  document.getElementById('toolbarInfo').textContent='第 '+d.page+'/'+d.totalPages+' 页 · 显示 '+d.reports.length+' 条';
}

// Pagination
function renderPgn(d){
  var p=document.getElementById('pagination');
  if(d.totalPages<=1){p.innerHTML='';return}
  var h='';
  h+='<button '+(d.page<=1?'disabled':'')+' onclick="goPage('+(d.page-1)+')">← 上一页</button>';
  h+='<span>'+d.page+' / '+d.totalPages+'</span>';
  h+='<button '+(d.page>=d.totalPages?'disabled':'')+' onclick="goPage('+(d.page+1)+')">下一页 →</button>';
  p.innerHTML=h;
  CP=d.page;
}

async function goPage(n){
  CP=n;
  var r=await fetch('/api/list-reports?password='+encodeURIComponent(PWD)+'&page='+n+'&limit='+LIM);
  var d=await r.json();
  if(d.error){alert(d.message);return}
  renderList(d);
  renderPgn(d);
  document.getElementById('reportCount').textContent='共 '+d.total+' 条报告';
}

async function refreshList(){await loadDash();}

// Detail Modal
async function viewDet(id){
  var o=document.getElementById('modalOverlay');
  var c=document.getElementById('modalContent');
  c.innerHTML='<div class="loading">⏳ 加载中...</div>';
  o.classList.add('show');
  var r=await fetch('/api/report-detail?id='+id+'&password='+encodeURIComponent(PWD));
  var d=await r.json();
  if(d.error){c.innerHTML='<p>❌ '+d.message+'</p>';return}
  var rp=d.report;
  var sm={'强':'tag-strong','中等':'tag-medium','弱':'tag-weak'};
  var h='';
  h+='<button class="modal-close" onclick="closeModal()">✕</button>';
  h+='<p style="font-size:11px;color:var(--text2)">'+fmtDate(rp.created_at)+' · '+esc(rp.role_label)+' 视角 · '+(rp.answer_count||0)+'个回答</p>';
  h+='<h3>📍 品牌定位语句</h3><div class="highlight">'+esc(rp.slot_sentence||'未填写')+'</div>';
  if(rp.positioning_strength)h+='<span class="tag '+(sm[rp.positioning_strength]||'')+'" style="margin-bottom:12px;display:inline-block">定位强度：'+rp.positioning_strength+'</span>';
  if(rp.miss_element)h+='<h3>🔑 不可替代性</h3><p>'+esc(rp.miss_element)+'</p>';
  if(rp.category_fit)h+='<h3>📂 品类定位</h3><p>'+esc(rp.category_fit)+'</p>';
  if(rp.usps&&rp.usps.length){
    h+='<h3>⚡ 核心卖点</h3><ul>';
    rp.usps.forEach(function(u){h+='<li><strong>'+esc(u.type)+'：</strong>'+esc(u.content)+'</li>'});
    h+='</ul>';
  }
  if(rp.keywords&&rp.keywords.length){
    h+='<h3>🏷️ 关键词</h3><div class="tags">';
    rp.keywords.forEach(function(k){h+='<span class="tag-item">'+esc(k)+'</span>'});
    h+='</div>';
  }
  if(rp.competitors&&rp.competitors.length){
    h+='<h3>⚔️ 竞品</h3><div class="tags">';
    rp.competitors.forEach(function(c){h+='<span class="tag-item">'+esc(c)+'</span>'});
    h+='</div>';
  }
  if(rp.taglines&&rp.taglines.length){
    h+='<h3>📣 宣传语候选</h3><ul>';
    rp.taglines.forEach(function(t){h+='<li>'+esc(t)+'</li>'});
    h+='</ul>';
  }
  if(rp.differentiators&&rp.differentiators.length){
    h+='<h3>🎯 差异化点</h3><ul>';
    rp.differentiators.forEach(function(d){h+='<li>'+esc(d)+'</li>'});
    h+='</ul>';
  }
  if(rp.painPoints&&rp.painPoints.length){
    h+='<h3>💢 客户痛点</h3><ul>';
    rp.painPoints.forEach(function(p){h+='<li>'+esc(p)+'</li>'});
    h+='</ul>';
  }
  if(rp.triggers&&rp.triggers.length){
    h+='<h3>🔔 购买触发点</h3><ul>';
    rp.triggers.forEach(function(t){h+='<li>'+esc(t)+'</li>'});
    h+='</ul>';
  }
  if(rp.analysis_summary)h+='<h3>🧠 综合分析</h3><p>'+esc(rp.analysis_summary)+'</p>';
  if(rp.nextSteps&&rp.nextSteps.length){
    h+='<h3>🚀 行动建议</h3><ol>';
    rp.nextSteps.forEach(function(s){h+='<li>'+esc(s)+'</li>'});
    h+='</ol>';
  }
  h+='<h3>📝 原始回答</h3>';
  if(rp.answers&&Object.keys(rp.answers).length){
    Object.entries(rp.answers).filter(function(e){return e[1]}).forEach(function(e){h+='<p><strong>'+esc(e[0])+'：</strong>'+esc(e[1])+'</p>'});
  }else{h+='<p style="color:var(--text2)">无</p>'}
  if(rp.followups&&Object.keys(rp.followups).length){
    h+='<p style="margin-top:8px;font-size:12px;color:var(--text2)">追问：</p>';
    Object.entries(rp.followups).filter(function(e){return e[1]}).forEach(function(e){h+='<p><strong>'+esc(e[0])+'：</strong>'+esc(e[1])+'</p>'});
  }
  if(rp.crossAnswers&&Object.keys(rp.crossAnswers).length){
    h+='<p style="margin-top:8px;font-size:12px;color:var(--text2)">交叉审视：</p>';
    Object.entries(rp.crossAnswers).filter(function(e){return e[1]}).forEach(function(e){h+='<p><strong>'+esc(e[0])+'：</strong>'+esc(e[1])+'</p>'});
  }
  h+='<div style="margin-top:24px;text-align:right;border-top:1px solid var(--border);padding-top:16px"><button class="del-btn" onclick="delRpt(\''+rp.id+'\');closeModal()">🗑️ 删除此报告</button></div>';
  c.innerHTML=h;
}

function closeModal(){document.getElementById('modalOverlay').classList.remove('show')}

// Delete
async function delRpt(id){
  if(!confirm('确定删除？'))return;
  var r=await fetch('/api/delete-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,password:PWD})});
  var d=await r.json();
  if(d.ok){refreshList()}else{alert(d.message||'删除失败')}
}

// Charts
var chartInstances={};
async function loadCharts(){
  try{
    var r=await fetch('/api/stats?password='+encodeURIComponent(PWD));
    var d=await r.json();
    if(d.error)return;
    document.getElementById('chartsRow').style.display='';
    document.getElementById('chartsRow2').style.display='';
    renderStrengthChart(d.strength||[]);
    renderRolesChart(d.roles||[]);
    renderDailyChart(d.daily||[]);
  }catch(e){console.log('图表加载失败:',e)}
}
function renderStrengthChart(data){
  var ctx=document.getElementById('chartStrength');
  if(chartInstances.strength)chartInstances.strength.destroy();
  var labels=data.map(function(r){return r.positioning_strength||'未知'});
  var values=data.map(function(r){return r.c});
  var colors={强:'#27ae60',中等:'#f39c12',弱:'#c0392b'};
  chartInstances.strength=new Chart(ctx,{
    type:'doughnut',
    data:{labels:labels,datasets:[{data:values,backgroundColor:labels.map(function(l){return colors[l]||'#999'})}]},
    options:{responsive:true,plugins:{title:{display:true,text:'🎯 定位强度分布',font:{size:14}},legend:{position:'bottom'}}}
  });
}
function renderRolesChart(data){
  var ctx=document.getElementById('chartRoles');
  if(chartInstances.roles)chartInstances.roles.destroy();
  chartInstances.roles=new Chart(ctx,{
    type:'bar',
    data:{labels:data.map(function(r){return r.role_label}),datasets:[{label:'报告数',data:data.map(function(r){return r.c}),backgroundColor:'#2980b9'}]},
    options:{responsive:true,plugins:{title:{display:true,text:'👤 各角色分析次数',font:{size:14}},legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  });
}
function renderDailyChart(data){
  var ctx=document.getElementById('chartDaily');
  if(chartInstances.daily)chartInstances.daily.destroy();
  chartInstances.daily=new Chart(ctx,{
    type:'line',
    data:{labels:data.map(function(r){return r.date}),datasets:[{label:'每日报告数',data:data.map(function(r){return r.c}),borderColor:'#b8860b',backgroundColor:'rgba(184,134,11,0.1)',fill:true,tension:0.3}]},
    options:{responsive:true,plugins:{title:{display:true,text:'📈 每日分析趋势（近30天）',font:{size:14}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  });
}

// ── 省份维度分析 ──

function injectProvinceBtn(){
  var old=document.getElementById('provinceBtnRow');
  if(old)old.remove();
  var oldR=document.getElementById('provinceResult');
  if(oldR)oldR.remove();
  var row=document.createElement('div');
  row.id='provinceBtnRow';
  row.style.cssText='margin-bottom:20px;text-align:center';
  row.innerHTML='<button class="sum-btn" style="background:linear-gradient(135deg,#8e44ad,#5b2c6f)" onclick="runProvinceInsights()">📊 省份维度分析（各省×角色样本统计 + AI共性需求）</button>';
  var prev=document.getElementById('summaryResult') || document.getElementById('summaryBtnRow');
  if(prev)prev.parentNode.insertBefore(row,prev.nextSibling);
  else{var stats=document.getElementById('stats');stats.parentNode.insertBefore(row,stats.nextSibling)}
}

async function runProvinceInsights(){
  var btn=document.querySelector('#provinceBtnRow .sum-btn');
  if(!btn)return;
  btn.disabled=true;
  btn.textContent='⏳ AI正在分析各省份角色数据...';
  btn.style.opacity='0.7';

  var oldR=document.getElementById('provinceResult');
  if(oldR)oldR.remove();
  var container=document.createElement('div');
  container.id='provinceResult';
  container.innerHTML='<div class="loading" style="padding:20px;text-align:center;color:var(--text2)">⏳ 正在读取省份数据并调用AI分析共性需求...</div>';
  btn.parentNode.insertBefore(container,btn.nextSibling);

  try{
    var r=await fetch('/api/province-insights?password='+encodeURIComponent(PWD));
    if(r.status===401){container.innerHTML='<p style="color:var(--red);text-align:center;padding:20px">❌ 密码错误</p>';return}
    var d=await r.json();
    if(d.error){container.innerHTML='<p style="color:var(--red);text-align:center;padding:20px">❌ '+d.message+'</p>';return}
    renderProvinceInsights(d,container);
  }catch(e){
    container.innerHTML='<p style="color:var(--red);text-align:center;padding:20px">❌ 请求失败：'+e.message+'</p>';
  }finally{
    btn.disabled=false;
    btn.textContent='📊 省份维度分析（各省×角色样本统计 + AI共性需求）';
    btn.style.opacity='1';
  }
}

function renderProvinceInsights(d,container){
  var h='';
  h+='<div class="sum-meta">📅 生成时间：'+fmtDate(d.generatedAt)+'</div>';

  // ── 省份×角色交叉表格 ──
  var roles=['manager','dealer','guide','service'];
  var roleIcons={manager:'📊',dealer:'🏪',guide:'🛍️',service:'🔧'};
  var roleLabels={manager:'销售经理',dealer:'经销商',guide:'导购',service:'售后'};

  h+='<h3 style="margin-bottom:10px;font-size:15px">🗺️ 省份 × 角色样本分布</h3>';
  h+='<div class="pv-table-wrap"><table class="pv-table">';
  h+='<thead><tr><th>省份</th>';
  roles.forEach(function(rid){h+='<th>'+roleIcons[rid]+' '+roleLabels[rid]+'</th>'});
  h+='<th>合计</th></tr></thead><tbody>';

  if(!d.grid||!d.grid.length){
    h+='<tr><td colspan="6" style="text-align:center;color:var(--text2)">暂无省份数据（需在有省份标记的问卷提交后显示）</td></tr>';
  } else {
    d.grid.forEach(function(row){
      h+='<tr><td class="pv-province">'+esc(row.province)+'</td>';
      roles.forEach(function(rid){
        var v=row.roles[rid];
        h+='<td class="pv-count">'+(v?v.count:0)+'</td>';
      });
      h+='<td class="pv-total">'+row.total+'</td></tr>';
    });
  }
  h+='</tbody></table></div>';

  // ── AI 共性需求分析 ──
  if(d.themeResults){
    h+='<h3 style="margin:24px 0 10px;font-size:15px">🧠 AI共性需求分析（按角色，附频次与省份）</h3>';
    h+='<div class="theme-cards">';
    roles.forEach(function(rid){
      var tr=d.themeResults[rid];
      if(!tr)return;
      h+='<div class="theme-card">';
      h+='<div class="theme-card-hd"><span>'+tr.icon+' '+esc(tr.roleLabel)+'</span><span style="font-size:11px;color:var(--text2)">样本 '+tr.totalCount+' 份</span></div>';
      h+='<div class="theme-card-body">';
      if(tr.summary&&!tr.parseError){
        h+='<div class="theme-summary">💬 '+esc(tr.summary)+'</div>';
      }
      if(tr.themes&&tr.themes.length){
        h+='<table class="theme-tbl"><thead><tr><th>共性主题</th><th>频次</th><th>出现省份</th></tr></thead><tbody>';
        tr.themes.forEach(function(t){
          var pvs=(t.provinces||[]).join('、');
          h+='<tr><td><strong>'+esc(t.theme)+'</strong><br><span style="font-size:11px;color:var(--text2)">'+esc(t.detail||'')+'</span></td>';
          h+='<td class="theme-freq">'+t.frequency+' 次</td>';
          h+='<td style="font-size:12px;color:var(--text2)">'+esc(pvs)+'</td></tr>';
        });
        h+='</tbody></table>';
      } else if(tr.note){
        h+='<p style="color:var(--text2);font-size:13px">📭 '+esc(tr.note)+'</p>';
      }
      h+='</div></div>';
    });
    h+='</div>';
  }

  h+='<div style="text-align:center;margin-top:16px"><button class="btn-refresh-sum" onclick="runProvinceInsights()">🔄 刷新分析</button></div>';
  container.innerHTML=h;
}

// Utils
function esc(s){
  if(!s)return'';
  var d=document.createElement('div');
  d.textContent=s;
  return d.innerHTML;
}
function fmtDate(ts){
  if(!ts)return'';
  var d=new Date(ts);
  var p=function(n){return String(n).padStart(2,'0')};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}
