# 定位罗盘 — 部署指南

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量（复制 .env.example 为 .env，填入 API Key）
cp .env.example .env

# 启动服务
npm start
# 访问 http://localhost:8899
```

## ☁️ 云端部署方案

### 方案一：Vercel（推荐，免费）

Vercel 原生支持 Express，自动将 `api/index.js` 转为 Serverless Function。

1. 注册 [Vercel](https://vercel.com)
2. 安装 Vercel CLI：`npm i -g vercel`
3. 在项目根目录执行：

```bash
vercel
# 按提示登录，确认配置：
#   - Build Command: (留空)
#   - Output Directory: public
#   - Development Command: npm start
```

4. 在 Vercel Dashboard → Settings → Environment Variables 中添加：
   - `DEEPSEEK_API_KEY` = 你的 DeepSeek API Key
   - `WHISPER_API_KEY` = 你的 OpenAI Whisper API Key（可选）

5. 部署后获得 `https://你的项目.vercel.app` 域名

**自动部署**：将项目推送到 GitHub/GitLab，在 Vercel 中关联仓库，每次 push 自动部署。

---

### 方案二：Railway（简单，支持 Express 直连）

1. 注册 [Railway](https://railway.app)
2. 关联 GitHub 仓库
3. Railway 自动检测 Node.js 项目并部署
4. 在 Variables 中添加 `DEEPSEEK_API_KEY`
5. 设置 Start Command：`node server.js`

---

### 方案三：自建服务器

```bash
# 上传项目到服务器
scp -r positioning-compass user@your-server:/opt/

# SSH 登录服务器
ssh user@your-server

# 安装并启动
cd /opt/positioning-compass
npm install
cp .env.example .env
# 编辑 .env 填入 API Key
npm start

# 推荐使用 PM2 保持进程
npm i -g pm2
pm2 start server.js --name positioning-compass
pm2 save
```

配合 Nginx 反向代理：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:8899;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📱 移动端适配说明

页面已针对手机端做了全面适配：

| 特性 | 说明 |
|------|------|
| 触控区域 | 所有按钮和可点击元素 ≥ 44px |
| 安全区 | 支持 iPhone 刘海屏/挖孔屏 safe-area-inset |
| 键盘适配 | 键盘弹起时自动缩小 header，保证输入区域可见 |
| 语音输入 | 移动端麦克风按钮全宽显示，拇指友好 |
| 字号防抖 | 输入框 16px 字体防止 iOS 自动缩放 |
| 3 档断点 | ≤374px / 375-480px / 481-768px |

## ⚠️ 注意事项

- **HTTPS 要求**：MediaRecorder（HD 语音）需要 HTTPS 或 localhost
- **API Key 安全**：`.env` 文件已在 `.gitignore` 中，不会被提交到仓库
- **Vercel 超时**：免费版函数最长 10 秒执行，AI 分析可能超时（建议升级 Pro 或使用 Railway）
- **DeepSeek API**：需要有效的 API Key 余额
