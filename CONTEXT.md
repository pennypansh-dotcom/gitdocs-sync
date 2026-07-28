# GitDocs Sync

GitDocs Sync 是一个面向“文档即产品”团队的 Git-native 多语言文档同步流水线。本文件只定义产品语言，不记录实现细节。

## Language

**文档即产品团队**:
文档直接影响获客、转化、留存、支持效率或产品评分的商业团队，通常使用 Docusaurus、Mintlify、Nextra 等工具，并且已经有多语言文档。
_Avoid_: 开源维护者、技术写作者、出海 PM、泛开发者

**Git-native 文档流水线**:
监听 GitHub 中源文档变更，通过 PR 更新目标语言文档，并保持现有文档站构建流程不变的工作流。
_Avoid_: 翻译工具、CMS、托管文档平台

**源文档**:
团队直接维护、作为事实来源的主语言文档。
_Avoid_: 原文、母版、主稿

**目标语言文档**:
由源文档生成，并通过 GitHub review 流程确认的翻译文档。
_Avoid_: 本地化副本、语言版本副本

**改动段落**:
GitDocs Sync 判定需要翻译的最小 Markdown 单位，例如段落、标题、列表项或表格行。
_Avoid_: 句子、整篇文档、diff 块

**翻译 PR**:
GitDocs Sync 自动创建的 pull request，包含某个目标语言的文档更新，交给开发者 review 和 merge。
_Avoid_: 自动提交、翻译任务结果

**Translation Memory**:
随 repo 保存的历史源段落和已接受翻译记录，用于完全匹配复用和保持翻译风格一致。
_Avoid_: 术语表、术语库、缓存

**Branding footer**:
按套餐或开源计划要求出现在翻译 PR 描述底部的 GitDocs Sync 署名。
_Avoid_: 水印、广告条

**开源计划**:
面向 public repo 的传播计划，用免费或折扣权益交换 GitDocs Sync 的可见品牌露出。
_Avoid_: 核心客户群、免费套餐

**同步体检报告**:
首次接入时生成的 GitHub Issue，用于说明目标语言文档的缺失、未追踪、超额和可同步状态，帮助客户决定是否补翻译。
_Avoid_: 翻译质量审计、历史质量报告

**未追踪**:
目标语言文档已经存在，但还没有被 GitDocs Sync 建立同步记录的状态。它不等于翻译错误，只表示系统尚不能保证后续增量同步准确追踪该文件。
_Avoid_: 落后、错误、低质量

**商业 MVP 约束**:
GitDocs Sync 在 MVP 阶段只做能推动目标用户试用、付费、留存或成本控制的功能。
_Avoid_: 大而全平台、展示性功能、低确定性自动化
