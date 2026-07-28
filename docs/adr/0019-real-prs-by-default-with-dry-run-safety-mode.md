# 默认真实创建 PR，dry-run 只是安全模式

GitDocs Sync 的 MVP 默认必须真实创建翻译 PR，因为产品信任来自客户在 GitHub 工作流里看到可 review、可 merge 的结果。`dry_run: true` 可以用于内部测试或客户首次谨慎试跑，它只输出计划，不创建 PR，也不调用翻译 provider。dry-run 不能替代 MVP 验收。
