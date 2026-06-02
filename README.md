# 定位罗盘 — 部署指南

## 本地开发

```bash
npm install                    # 安装依赖
cp .env.example .env           # 复制配置模板
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm start                      # 启动服务 → http://localhost:8899
```

---

## ☁️ Cloudflare Pages 部署（推荐，免费）

项目已配置好 Cloudflare Pages Functions，无需改代码，关联 GitHub 仓库即可部署。

### 第一步：关联 GitHub 仓库

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com) 并登录
2. 左侧菜单点击 **Workers & Pages**
3. 点击 **创建** → **Pages** → **连接到 Git**

![](https://via.placeholder.com/600x300/f5f3f0/5c3d0a?text=Workers+%26+Pages+%E2%86%92+%E5%88%9B%E5%BB%BA+%E2%86%92+Pages+%E2%86%92+%E8%BF%9E%E6%8E%A5%E5%88%B0+Git)

4. 选择 **GitHub**，授权 Cloudflare 访问你的仓库
5. 在仓库列表中选择 `r3soso/positioning-compass`
6. 点击 **开始设置**

### 第二步：配置构建设置

| 配置项 | 填写内容 |
|--------|----------|
| **项目名称** | `positioning-compass`（自动填入） |
| **生产分支** | `master` |
| **构建命令** | （**留空**，本项目无需构建） |
| **构建输出目录** | `public` |

> ⚠️ 构建命令留空。本项目是纯静态 HTML + JS + CSS，不需要 `npm run build`。

点击 **保存并部署**。

### 第三步：配置环境变量（启用 AI）

部署完成后，进入项目页面：

1. 点击顶部 **Settings** 标签页
2. 左侧菜单选择 **Environment variables**
3. 点击 **添加变量**，填入：

| 变量名 | 值 |
|--------|-----|
| `DEEPSEEK_API_KEY` | `sk-e76570acc1464e71ba0dbd33710bb4c9` |

4. 点击 **保存**，系统会自动重新部署

### 第四步：验证

部署成功后，你会看到：

```
✨ 部署成功！
https://positioning-compass.pages.dev
```

用浏览器打开这个地址，就能使用了。之后每次 `git push`，Cloudflare 会自动重新部署最新代码。

---

## Vercel 部署（备选方案）

1. 打开 [vercel.com](https://vercel.com) → **Import Git Repository** → 选择 `positioning-compass`
2. 配置：
   - **Build Command**：（留空）
   - **Output Directory**：`public`
3. 在 Settings → Environment Variables 中添加 `DEEPSEEK_API_KEY`

---

## 自建服务器部署

```bash
# 上传项目
scp -r positioning-compass user@your-server:/opt/

# SSH 登录，安装启动
ssh user@your-server
cd /opt/positioning-compass
npm install
cp .env.example .env
# 编辑 .env 填入 API Key

# PM2 守护进程
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
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 📁 项目架构

```
positioning-compass/
├── public/                     # 前端静态文件 → Cloudflare Pages 直接分发
│   ├── index.html
│   ├── css/  (6 个模块)
│   └── js/   (12 个模块)
├── functions/                  # Cloudflare Pages Functions → 自动转为 API
│   ├── _middleware.js          # CORS + 安全头
│   └── api/
│       ├── analyze.js          # POST /api/analyze（DeepSeek AI分析）
│       ├── generate-followup.js # POST /api/generate-followup（AI追问）
│       ├── health.js           # GET /api/health
│       └── voice/transcribe.js # POST /api/voice/transcribe（Whisper）
├── api/index.js                # Vercel 适配（Express → Serverless）
├── server.js                   # 本地开发 Express 服务器
├── wrangler.toml               # Cloudflare 配置
└── vercel.json                 # Vercel 配置
```

**同一个代码库，三种部署方式：**

| 平台 | 前端 | API 后端 | API 适配文件 |
|------|------|----------|--------------|
| **Cloudflare Pages** | `public/` → CDN | `functions/` → Workers | `_middleware.js` + handlers |
| **Vercel** | `public/` → CDN | `api/index.js` → Serverless | Express 封装 |
| **自建服务器** | `public/` → 静态 | `server.js` → Express | 无需适配 |

---

## 📱 移动端适配说明

| 特性 | 说明 |
|------|------|
| 触控区域 | 所有按钮和可点击元素 ≥ 44px |
| 安全区 | 支持 iPhone 刘海屏/挖孔屏 `safe-area-inset` |
| 键盘适配 | 键盘弹起时自动缩小 header，保证输入区域可见 |
| 语音输入 | 移动端麦克风按钮全宽显示，拇指友好 |
| 字号防抖 | 输入框 16px 字体防止 iOS 自动缩放 |
| 3 档断点 | ≤374px / 375-480px / 481-768px |

## ⚠️ 注意事项

- **API Key 安全**：`.env` 文件已在 `.gitignore` 中，不会被提交到 GitHub。密钥通过 Cloudflare Dashboard 环境变量设置
- **Cloudflare Pages 免费额度**：每月 10 万次请求，完全够用
- **DeepSeek API 费用**：按 token 计费，每次分析约消耗 2000-3000 token，成本很低
