# 首次同步范围用 Issue 固定命令确认

客户在首次同步体检 Issue 中通过固定评论命令确认补翻译范围，例如 `/gitdocs sync all`、`/gitdocs sync zh`、`/gitdocs sync zh,ja` 或 `/gitdocs future-only`。第一版不解析自然语言，也不依赖 checkbox 状态变化，因为固定命令更容易稳定触发、审计和实现，同时仍然保留在 GitHub 工作流内。
