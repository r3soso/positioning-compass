-- 定位罗盘 D1 数据库 Schema
-- 在 Cloudflare Dashboard → D1 → 控制台执行此 SQL

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  role TEXT NOT NULL,
  role_label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  province TEXT NOT NULL DEFAULT '',
  slot_sentence TEXT,
  miss_element TEXT,
  keywords TEXT,
  competitors TEXT,
  usps TEXT,
  taglines TEXT,
  positioning_strength TEXT,
  category_fit TEXT,
  analysis_summary TEXT,
  differentiators TEXT,
  pain_points TEXT,
  triggers TEXT,
  next_steps TEXT,
  answer_count INTEGER DEFAULT 0,
  answers TEXT,
  followups TEXT,
  cross_answers TEXT,
  raw_report TEXT
);

-- 按时间倒序查询索引
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- 按角色筛选索引
CREATE INDEX IF NOT EXISTS idx_reports_role ON reports(role);

-- 按省份筛选索引
CREATE INDEX IF NOT EXISTS idx_reports_province ON reports(province);
