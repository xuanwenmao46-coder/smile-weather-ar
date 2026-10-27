# 2027 TikTok Design｜Gifts and Effects（AI Product Design）笔试

## Part 1. 自动化 Pipeline 设计

### 1. 架构设计

#### 设计思路

如果由我负责下个月上线的 50 个文化区域礼物，我首先会把它当作一个持续的资产生产任务，而不是 50 个独立的设计需求。

TikTok LIVE 礼物和一般的视觉素材不同。它出现在直播互动的瞬间，观众需要快速看清主体、感受到送礼的情绪，主播也需要获得明确的反馈。因此，礼物既要有足够的视觉表现力，也不能过度遮挡直播内容。

真正困难的地方有两个：一是不同地区的文化表达存在差异，不能简单套用国旗、地标和传统符号；二是 50 个区域同时制作，如果每个礼物都经历完整的人工设计、沟通和审核，时间和成本都难以控制。

**我的解决思路是：尽量复用稳定的资产结构，把需要本地化的部分开放给 AI 生成，再用独立的审核环节控制风险。**

具体来说，我会先建立一套共享的礼物设计规范，包括视觉层级、动效节奏、材质表现和技术限制，再用区域文化配置决定每个礼物的差异化内容。

上线时间较紧，我会先选取几个文化差异、资产复杂度和审核风险不同的区域进行小批量验证。确认模板复用、生成、审核和导出流程跑通后，再批量处理剩余地区，避免在正式生产时才发现管线存在系统性问题。

#### Agent 分工

我将生产流程拆成五个 Agent，由一个代码层 Orchestrator 统一调度。

**Agent 0｜Orchestrator（任务调度）**

输入：`region_id`、`occasion`、`tier`、交付时间与成本预算。

它不负责创意，只负责生产流程的管理，包括任务分发、状态记录、版本控制、重试次数和异常熔断。

我希望所有 Agent 都通过结构化数据交接，而不是直接传递完整的自由文本对话，减少上下文漂移。

**Agent 1｜Regional Brief Agent（区域文化需求整理）**

输入：目标区域、礼物主题、已审核的文化资料和平台政策。

输出：`RegionalBrief.json`

主要包含：

- 推荐的文化元素与视觉参考
- 配色和风格方向
- 明确受限的符号及对应规则
- 本地化命名建议
- 资料来源、文化置信度与政策版本

这一阶段我会特别注意避免文化标签化。例如，不能因为某个地区存在特定宗教传统，就直接认定所有相关动物、颜色或符号都不适合使用。

对于缺乏可靠资料的小语种地区，我宁愿先采用相对中性的视觉语言，并交给本地审核人员确认，也不让模型自行编造当地文化。

**Agent 2｜Concept Generation Agent（礼物概念生成）**

输入：`RegionalBrief + GlobalDesignTokens + GiftRequirements`

输出：`ConceptSpec.json`

每个任务先生成三个不同方向的概念，包含主体造型、材质色彩、动画路径、粒子效果、音效情绪和本地化名称。

这里我不会让 AI 直接输出最终 3D 礼物。

原因是完整资产的制作成本高，而早期创意问题通常在概念阶段就能发现。先用结构化概念筛选，可以减少无效建模和反复渲染。

概念筛选时，我主要看三个问题：

1. 这个礼物能否在直播画面中迅速被识别？
2. 动效是否符合礼物档位的情绪价值，而不只是堆叠特效？
3. 文化元素是否真正服务于创意，而不是简单把地方符号贴到同一个模型上？

通过评分筛选出一个候选概念。重要活动或高价值礼物增加设计师人工判断。

**Agent 3｜Cultural Compliance Agent（独立文化合规审查）**

输入：`ConceptSpec + RegionalPolicy + PlatformPolicy`

输出：`ComplianceReport`

状态分为：

- `PASS`：通过，进入生产。
- `WARN`：存在文化歧义，交由人工确认。
- `REJECT`：违反明确规则，返回具体原因和修改建议。

我会把文化审查放在概念生成之后、正式资产生成之前，而不是等模型和动画都做完再审核。

同时，审查 Agent 必须与生成 Agent 独立。它依据实际概念内容和政策规则判断，而不是依赖生成模型对自己作品的评价。

被驳回的概念返回 Agent 2 修改，修改后必须重新审核，不能跳过这一环节。

**Agent 4｜Asset Generation Agent（资产生成）**

输入：审核通过的 `ConceptSpec + TechnicalSpec`

输出：`AssetBundle`

负责调用对应的生产工具生成模型、材质、贴图、动画和渲染预览。

我会根据礼物复杂度选择不同生产方式：

- 低复杂度：2D / 2.5D 动效。
- 中等复杂度：复用基础 3D 模型，调整材质、造型细节和动画参数。
- 高复杂度：独立生成 3D 模型与动画。

例如，两个地区的礼物都采用花朵展开的动效，可以共用已经验证过的动画结构，主要调整花瓣造型、材质和粒子表现，不必从零制作两套动画。

资产生成工具通过统一接口调用，具体的工程格式由实际业务工具链决定。

**Agent 5｜Technical & Experience QA Agent（技术与体验检查）**

输入：`AssetBundle + TechnicalSpec + ApprovedConcept`

输出：`QAReport`

我会把检查分成两部分。

技术检查主要关注几何结构、UV、贴图、动画完整性、资源大小、目标设备性能和文件格式。

体验检查则关注小屏识别度、动效节奏、视觉层级、品牌一致性，以及礼物是否过度遮挡主播。

技术阈值从已经确认的 `TechnicalSpec` 中读取，而不是写死模型面数或假设一个并未验证的 TikTok 内部标准。

另外，概念合规不代表生成结果一定合规。最终渲染预览还要再次交给 Cultural Compliance Agent 检查，防止生成过程中意外出现敏感元素。

#### 数据流与拦截机制

```text
Business Input
region / occasion / tier
           │
           ▼
      Orchestrator
     调度 / 预算 / 状态
           │
           ▼
[1] Regional Brief Agent
           │
      RegionalBrief
           │
           ▼
[2] Concept Generation Agent
           │
     3 个候选 Concept
           │
           ▼
[3] Cultural Compliance Agent
       │             │
      PASS       WARN / REJECT
       │             │
       │         人工确认或
       │         带原因修改
       │         返回 Agent 2
       ▼
   Approved Concept
           │
           ▼
[4] Asset Generation Agent
           │
       AssetBundle
           │
           ▼
[5] Technical & Experience QA
       │             │
      PASS          FAIL
       │             │
       │         定向修复
       │         或异常熔断
       ▼
  Post-render Cultural Check
       │             │
      PASS        FAIL / WARN
       │             │
       │          隔离审核
       ▼
    Asset Registry
           │
           ▼
     Release Package
```

我会采用 **Fail-Closed** 的质量控制方式：任何强制检查没有明确通过，都不能自动进入上架流程。

每次驳回都需要保留具体的错误代码、规则 ID 和修改建议，再将信息回传给对应 Agent。这样下一次是针对问题进行修复，而不是简单重新抽取一次结果。

同时，所有资产都记录对应的 Brief、Concept、模型、政策和审核版本。如果上线后出现问题，可以追溯到底是文化资料有误、生成结果偏离，还是审核规则遗漏。

---

### 2. 上下文工程：生成 Agent 的核心 System Prompt

#### 我的设计方式

对于生成 Agent，我不希望它每次收到一大段自然语言后自行理解、决策和调用工具。

我会把输入分成三个部分：

- 固定规则：角色、工具权限、输出格式及安全要求。
- 任务上下文：已经审核的概念、区域文化限制、技术规格。
- 运行状态：失败记录、重试次数及剩余预算。

生成 Agent 只输出工具调用指令，由 Orchestrator 检查后执行。

这样即使模型出现格式错误、误解限制或试图调用未经授权的工具，也不会直接影响生产环境。

#### Core System Prompt

```text
You are TikTok LIVE Gift Asset Generation Agent.

ROLE:
Convert approved gift concepts into structured
asset-generation instructions.

You are a tool-call planner, not a tool executor.

INPUT:
- task_id
- concept_id
- approved_concept
- regional_brief
- cultural_constraints
- technical_spec
- generation_history
- retry_count
- max_retries

OUTPUT RULES:
1. Return exactly one valid JSON object.
2. Follow the registered strict JSON Schema.
3. Do not include Markdown, comments or extra text.
4. Use only the registered tool: generate_gift_asset.
5. Never invent tool parameters or technical limits.
6. Preserve task_id and concept_id.
7. Do not modify approved concepts independently.
8. Only READY status may contain a tool call.

REQUIRED JSON FIELDS:
- task_id
- concept_id
- status
- retry_count
- error_code
- tool_calls
- recovery_action

STATUS ENUM:
READY
RETRY_REQUIRED
HUMAN_REVIEW_REQUIRED
BLOCKED

ALLOWED TOOL:
generate_gift_asset

REQUIRED TOOL PARAMETERS:
- asset_type
- visual_prompt
- motion_spec
- technical_profile_id

CULTURAL SAFETY:
Check the proposed asset against the approved
regional policy and cultural constraints.

Do not treat all religious symbols as
universally prohibited.

If a religious symbol is prohibited by the
applicable policy:

1. Do not issue a generation tool call.
2. Set status to RETRY_REQUIRED.
3. Set error_code to PROHIBITED_RELIGIOUS_SYMBOL.
4. Return tool_calls as an empty array.
5. Provide the violated rule ID and a culturally
   appropriate neutral replacement.
6. Request concept revision and independent
   cultural compliance review.

RETRY RULES:
retry_count is maintained by Orchestrator.
Never increment or reset it.

If retry_count >= max_retries:
- status = HUMAN_REVIEW_REQUIRED
- error_code = RETRY_LIMIT_EXCEEDED
- tool_calls = []

If cultural policy is ambiguous:
- status = HUMAN_REVIEW_REQUIRED
- error_code = AMBIGUOUS_CULTURAL_POLICY
- tool_calls = []

If technical specifications are missing:
- status = BLOCKED
- error_code = MISSING_SPECIFICATION
- tool_calls = []

Never repeat a failed design without addressing
the specific rejection reason.

FINAL OUTPUT:
JSON only.
```

#### JSON Schema 与调用示例

为避免大模型输出格式不稳定，我会在 API 层使用严格 JSON Schema 约束，而不是只在 Prompt 中写“请输出 JSON”。

以下为生成指令的核心 Schema：

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "task_id": {
      "type": "string"
    },
    "concept_id": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "READY",
        "RETRY_REQUIRED",
        "HUMAN_REVIEW_REQUIRED",
        "BLOCKED"
      ]
    },
    "retry_count": {
      "type": "integer",
      "minimum": 0
    },
    "error_code": {
      "type": ["string", "null"]
    },
    "tool_calls": {
      "type": "array",
      "maxItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "tool_name": {
            "type": "string",
            "enum": ["generate_gift_asset"]
          },
          "parameters": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "asset_type": {
                "type": "string",
                "enum": ["2D", "2.5D", "3D"]
              },
              "visual_prompt": {
                "type": "string"
              },
              "motion_spec": {
                "type": "string"
              },
              "technical_profile_id": {
                "type": "string"
              }
            },
            "required": [
              "asset_type",
              "visual_prompt",
              "motion_spec",
              "technical_profile_id"
            ]
          }
        },
        "required": [
          "tool_name",
          "parameters"
        ]
      }
    },
    "recovery_action": {
      "anyOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "rule_id": {
              "type": "string"
            },
            "replacement": {
              "type": "string"
            }
          },
          "required": [
            "rule_id",
            "replacement"
          ]
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "task_id",
    "concept_id",
    "status",
    "retry_count",
    "error_code",
    "tool_calls",
    "recovery_action"
  ]
}
```

**正常生成示例：**

```json
{
  "task_id": "GIFT_017",
  "concept_id": "C03",
  "status": "READY",
  "retry_count": 0,
  "error_code": null,
  "tool_calls": [
    {
      "tool_name": "generate_gift_asset",
      "parameters": {
        "asset_type": "3D",
        "visual_prompt": "A festive abstract bloom with layered petals and soft light.",
        "motion_spec": "Open quickly, hold the focal shape, then fade.",
        "technical_profile_id": "LIVE_GIFT_STANDARD_V1"
      }
    }
  ],
  "recovery_action": null
}
```

其中 `generate_gift_asset` 为设计的内部工具接口，`LIVE_GIFT_STANDARD_V1` 为示例技术配置 ID，正式运行时需要关联真实的资产生产工具与技术规范。

**宗教违规符号异常示例：**

```json
{
  "task_id": "GIFT_017",
  "concept_id": "C03",
  "status": "RETRY_REQUIRED",
  "retry_count": 0,
  "error_code": "PROHIBITED_RELIGIOUS_SYMBOL",
  "tool_calls": [],
  "recovery_action": {
    "rule_id": "REGION_POLICY_042",
    "replacement": "Replace the restricted motif with non-religious flowing light patterns."
  }
}
```

这里的规则 ID 仅作格式示例，实际由政策库提供。

当模型识别到被明确禁止的宗教符号时，不会自行替换后直接生成，而是先返回修复方向。Orchestrator 将其交给 Concept Agent 修改，并重新经过文化审核。

每类异常最多自动重试 2 次。如果仍不能解决，或当前文化限制存在歧义，就转交人工审核。

这一点对我来说很重要：**文化合规不是把宗教符号全部过滤掉，而是判断符号在具体地区和使用场景中是否合适。** 过度过滤虽然可能降低一部分风险，却也会损害礼物本身的文化识别度。

Schema 之外，服务端还要校验状态与字段的关系：`READY` 必须有一个合法工具调用；其他状态的 `tool_calls` 必须为空；`retry_count` 必须与 Orchestrator 记录一致。

这样才能把 JSON 格式约束和真实的执行权限分开。

---

### 3. 保险机制：Circuit Breaker

#### 我会先判断为什么会陷入死循环

如果某个小语种区域的礼物一直生成失败，我不会第一时间继续调整 Prompt。

我会先看失败到底发生在哪一层：

- 如果文化资料和翻译不准确，模型可能从一开始就理解错了主体结构。
- 如果创意概念没有明确几何约束，后续生成可能持续出现结构冲突。
- 如果几何已经接近正确，只是局部网格不合格，反复生成整个模型反而是一种浪费。

所以，我认为断路器不能只是一个“失败三次就停止”的计数器，还需要判断当前修复有没有真正改善结果。

#### 3.1 触发条件

断路器由 Orchestrator 的代码逻辑控制，不依赖大模型主动停止。

以下作为初始策略：

| 监控指标 | 触发条件 | 处理 |
|---|---|---|
| 同阶段重试 | 超过 2 次仍失败 | 停止自动修复 |
| 重复几何冲突 | 连续 3 次出现同类错误且无改善 | 提前熔断 |
| JSON 校验 | 连续 3 次结构化输出失败 | 停止该任务 |
| 执行时间 | 达到该档位的时间预算，例如 10 分钟 | 取消后续执行 |
| 计算成本 | 达到 GPU / Token 硬预算 | 停止资源分配 |
| 区域批量异常 | 同区域至少 10 个任务，失败率超过 30% | 暂停区域新增任务 |

这些数值是管线初期的治理参数，后续应依据真实生成耗时、资产复杂度和失败率调整。

其中，我最关注几何检查结果是否在改善。

例如，第一次检测出大量自相交面，第二次修复后数量明显下降，说明当前策略仍可能有效；但如果连续几次都出现几乎相同的非流形结构，就没有必要继续消耗同样的算力。

另外，各阶段重试次数独立统计，但仍受任务总时间与总成本预算限制，避免不同 Agent 之间来回重试。

#### 3.2 熔断后的处理

我会采用三种运行状态：

**CLOSED：正常运行**

任务正常执行，允许在预算内进行有明确目标的重试。

**OPEN：停止并保存现场**

一旦触发熔断：

- 立即停止新的生成请求，尝试取消正在执行的任务。
- 保留最近一次有效资产、Prompt、模型参数、错误报告及 Trace ID。
- 将失败任务移入独立队列，避免持续占用计算资源。
- 向负责的设计师和工程师发送具体异常信息。

我不会因为一个国家的一个礼物失败，就直接停止这个国家甚至全部 50 个区域的生产。

优先隔离单个任务。只有同一区域多个任务集中出现相同问题时，才升级为区域级暂停。

**HALF-OPEN：低成本试探恢复**

当文化资料、技术参数或生成方式发生实质变化后，允许一次低成本测试。

如果通过，恢复生产；如果仍失败，则继续保持熔断。

涉及文化安全的不确定问题，需要人工确认后才能恢复。

#### 3.3 止损与降级方案

我会按照对原始设计影响从小到大的顺序处理。

**第一步：局部修复。**

如果是法线、UV 或局部网格错误，优先调用脚本修复，而不是重新生成完整模型。

**第二步：回退到稳定模板。**

如果复杂几何结构持续失败，使用已经验证过的基础模型，只修改材质、纹样、配色和动画细节。

例如，某个地区的特殊花卉造型不断产生自相交问题，可以先使用通用花瓣结构，再通过轮廓调整和材质表现保留必要的区域特色。

**第三步：降低资产复杂度。**

如果 3D 模型始终无法稳定生成，可以在不损害核心礼物体验的情况下，改用 2.5D 分层动画或 2D 动效。

这不是简单降低画质，而是保留用户最能感知到的部分：主体形象、关键动作和情绪反馈。

**第四步：人工接管与上线兜底。**

如果降级后仍达不到要求，我会让系统生成异常摘要，包含失败原因、已尝试方案、可用版本和资源消耗，由设计师判断是否重新设计。

对于临近上线的区域，如果存在已通过当地合规审核的存量礼物，可以先作为替代资产；如果没有合适的替代方案，就不强行上线未经验证的内容。

#### 3.4 让失败经验回到生产流程

最后，我会把每次失败按原因归类。

如果问题来自文化资料，就在人工核实后更新区域知识库；如果问题来自几何结构，就增加参数化模板或前置检查；如果某类礼物经常需要人工修改，则重新评估它是否适合完全自动生成。

我会持续关注几个指标：首次审核通过率、单个合格资产的生成成本、平均返工次数、人工介入率和交付时间。

这些数据不只是为了评估 AI 的效率，也是为了帮助设计师判断：哪些设计工作适合交给模型，哪些环节保留人工判断反而更有效。

---

### 最后

在这个任务中，我不追求让 AI 自动生成最多的礼物，而是希望建立一条能够不断复用、修正和扩展的设计生产流程。

我认为设计师在其中最重要的工作，是确定什么值得生成、什么算是合格，以及什么情况下应该停止。

AI 可以负责大量重复制作，但文化理解、审美方向、产品体验和最终的质量判断，仍然需要被明确地设计进整个系统。

**最终目标是让 50 个区域的礼物既保持统一的产品品质，又有各自合理的文化表达，并且能够在可控成本和时间内稳定交付。**
