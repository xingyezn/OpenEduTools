-- OpenEduTools 匿名使用统计：每日 × 工具聚合表。
-- 不保存原始事件、IP、账号或任何用户输入内容。

CREATE TABLE IF NOT EXISTS tool_daily_stats (
    date TEXT NOT NULL,
    tool_id TEXT NOT NULL,

    opens INTEGER NOT NULL DEFAULT 0,
    uses INTEGER NOT NULL DEFAULT 0,

    favorite_adds INTEGER NOT NULL DEFAULT 0,
    favorite_removes INTEGER NOT NULL DEFAULT 0,

    shares INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (date, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_daily_stats_tool
ON tool_daily_stats(tool_id);

CREATE INDEX IF NOT EXISTS idx_tool_daily_stats_date
ON tool_daily_stats(date);
