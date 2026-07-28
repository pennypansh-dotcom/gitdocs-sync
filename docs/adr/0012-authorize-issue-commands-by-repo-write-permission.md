# Issue 命令必须由 repo 写权限成员触发

首次同步体检 Issue 中的 `/gitdocs` 命令只有 repo owner、admin、maintainer 或具备 write 权限的成员评论时才生效。public repo 中外部用户的命令不会消耗额度，也不会创建 PR。这个限制能防止品牌曝光场景下被陌生评论触发成本，同时保持确认流程在 GitHub 内完成。
