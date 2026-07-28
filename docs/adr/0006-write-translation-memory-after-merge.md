# Translation Memory 在 merge 后写入

Translation Memory 只把已经 merge 的翻译视为 active 记录。PR 创建阶段的翻译只是候选结果；如果客户在 PR 中修改了译文，以 merge 后的最终文件为准写入 TM。这避免未确认或错误的机器翻译污染后续翻译风格。
