# 第一版使用 GitHub Action 而不是 GitHub App

第一版继续使用 GitHub Action 接入，并要求最小权限 `contents: write`、`pull-requests: write` 和 `issues: write`。GitHub App 可以降低长期接入成本，但会增加安装、授权、事件处理和产品解释成本；在 MVP 阶段，Action 更适合快速验证 Docusaurus 文档同步和翻译 PR 工作流。
