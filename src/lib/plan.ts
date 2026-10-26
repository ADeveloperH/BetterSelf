import type { PlanStatus } from '../types'

export const planStatusLabels: Record<PlanStatus, string> = {
  todo: '未开始',
  active: '进行中',
  completed: '已完成',
}

export const planPhases = [
  { title: '盘点经历与基础', weeks: '第 1～4 周', goal: '明确职责，讲通一个真实流程。' },
  { title: '深入玩法与工具', weeks: '第 5～8 周', goal: '用边界验证，把玩法经验做深。' },
  { title: 'UI、资源与真机', weeks: '第 9～12 周', goal: '留下运行证据，开始校准岗位。' },
  { title: '系统设计与异步', weeks: '第 13～16 周', goal: '解释取舍，完成一次模拟面试。' },
  { title: '形成求职材料', weeks: '第 17～20 周', goal: '补齐案例和简历，用反馈修正。' },
  { title: '面试与缓冲', weeks: '第 21～24 周', goal: '围绕实际反馈，只补最大的缺口。' },
]

export interface PlanTask {
  id: string
  week: number
  phase: number
  title: string
  actions: string[]
  outcome: string
  articleIds?: string[]
  questionIds?: string[]
}

export interface PlanView {
  section: 'route' | 'cases'
  week: number
  caseId: string
}

export interface PlanCase {
  id: string
  title: string
  description: string
  prompts: string[]
  articleIds?: string[]
  projectId?: string
}

export const defaultPlanView = (): PlanView => ({
  section: 'route',
  week: 0,
  caseId: 'unity-case-gameplay',
})

const taskContent: Omit<PlanTask, 'id' | 'week' | 'phase'>[] = [
  {
    title: '盘点个人职责，选定主案例',
    actions: [
      '区分外购代码、已有 SDK、自己的设计与修改。',
      '选择一个熟悉的 Unity 玩法模块，查看两个北京社招岗位。',
    ],
    outcome: '一页职责清单，明确主案例与两个岗位样本。',
  },
  {
    title: '跟通一次玩法操作',
    actions: [
      '从输入跟到规则计算、数据更新、动画和结算。',
      '找出使用集合的位置，解释查找和更新的代价。',
    ],
    outcome: '一张调用链，标出三个关键状态变化。',
    articleIds: ['csharp-memory-basics'],
    questionIds: ['q-value-reference'],
  },
  {
    title: '理解事件与对象引用',
    actions: ['跟踪一次事件订阅、触发和解绑。', '用小例子验证闭包或静态事件怎样持有对象。'],
    outcome: '一个引用关系示例，说明谁负责解绑。',
    articleIds: ['csharp-memory-basics'],
    questionIds: ['q-boxing'],
  },
  {
    title: '第一次脱稿讲项目',
    actions: [
      '累计整理五个去重的匹配岗位。',
      '讲五分钟项目背景、职责和一个问题，标出讲不清的部分。',
    ],
    outcome: '简历提纲与一次讲解复盘。',
  },
  {
    title: '检查玩法状态与缓存',
    actions: ['列出规则状态、表现状态和派生缓存。', '检查移动、移除、复活等变化如何使缓存失效。'],
    outcome: '一张状态变化与缓存失效表。',
  },
  {
    title: '分析关卡搜索与校验',
    actions: [
      '用手工小关卡解释搜索状态、去重与复杂度。',
      '区分非法配置、预算耗尽和搜索范围内的无解。',
    ],
    outcome: '一个小关卡推演与结果分类说明。',
  },
  {
    title: '验证动画、重开与复活边界',
    actions: ['分析逻辑变化与动画完成的先后关系。', '验证快速重开或回调迟到时，新关卡是否受影响。'],
    outcome: '三个异常时序用例及一项最小验证。',
    questionIds: ['q-coroutines'],
  },
  {
    title: '完成玩法主案例',
    actions: ['整理职责、设计、难点、验证和不足。', '进行一次十分钟追问，补上证据缺口。'],
    outcome: '一个可讲述的玩法与关卡工具案例。',
  },
  {
    title: '跟踪弹窗生命周期',
    actions: ['跟通创建、显示、关闭、缓存和销毁。', '确认资源与事件的所有者，检查输入与层级边界。'],
    outcome: '一张 UI 生命周期图与释放责任说明。',
  },
  {
    title: '做资源加载与释放实验',
    actions: ['先理解当前资源入口实际负责什么。', '在小实验中配对加载释放，记录引用仍由谁持有。'],
    outcome: '一份资源所有权与实验记录。',
  },
  {
    title: '采集一次真机基线',
    actions: [
      '固定设备、版本、构建方式与操作步骤。',
      '记录帧耗时、分配或内存趋势中的一项，不预设有问题。',
    ],
    outcome: '一份带环境、步骤和原始数据的记录。',
    questionIds: ['q-gc-alloc'],
  },
  {
    title: '简历初稿与少量投递',
    actions: [
      '用实际负责的模块、取舍和验证结果写经历。',
      '选择一至两个匹配岗位沟通或投递，记录反馈。',
    ],
    outcome: '简历第一版与首次求职反馈。',
  },
  {
    title: '明确框架与宿主边界',
    actions: [
      '画出通用模块、具体玩法与底层 SDK 的依赖关系。',
      '解释一个保留具体实现或抽象接口的决策。',
    ],
    outcome: '一张依赖图与一项设计取舍。',
  },
  {
    title: '分析异步请求生命周期',
    actions: [
      '选择一条奖励或网络请求链，画出关键状态。',
      '讨论超时、重复回调、重开和服务端幂等的不同责任。',
    ],
    outcome: '一张时序图与三个异常场景的预期结果。',
    questionIds: ['q-coroutines'],
  },
  {
    title: '补齐真机构建差异',
    actions: ['核对 IL2CPP、AOT、反射与裁剪的基本机制。', '关联一个项目里的使用点，写出排查顺序。'],
    outcome: '一张 Editor 正常而真机异常的排查卡。',
    articleIds: ['unity-android-jdk17'],
  },
  {
    title: '整理系统案例并模拟面试',
    actions: [
      '完成 UI 或框架案例，补足异常流程和取舍。',
      '做一次约四十分钟模拟，列出最大的三个缺口。',
    ],
    outcome: '第二个主案例与第一次完整模拟复盘。',
  },
  {
    title: '选一个真实问题验证',
    actions: [
      '从真机基线选取实际性能问题或生命周期边界。',
      '先写复现步骤和成功标准；没有异常也如实记录。',
    ],
    outcome: '一份可复现的问题单或稳定性验证方案。',
    questionIds: ['q-gc-alloc'],
  },
  {
    title: '完成对比与回归',
    actions: ['保持环境一致，做一次单变量对比或边界验证。', '保留原始记录、替代解释和适用边界。'],
    outcome: '第三个主案例：性能或稳定性验证。',
  },
  {
    title: '准备交付备用案例',
    actions: ['用已有记录追踪一次插件依赖与版本变化。', '解释自己负责的部分，再做一次完整模拟。'],
    outcome: '一页插件交付案例与第二次模拟复盘。',
  },
  {
    title: '检查求职准备程度',
    actions: ['核对简历、三个主案例和一个备用案例。', '复述重点基础题，决定下一轮匹配岗位。'],
    outcome: '一套真实可解释的求职材料与缺口清单。',
  },
  {
    title: '补一个最关键的缺口',
    actions: ['依据实际面试或模拟反馈选一个问题。', '通过小实验修正理解，再脱稿讲解。'],
    outcome: '一次有验证证据的针对性修正。',
  },
  {
    title: '继续面试与反馈',
    actions: [
      '按匹配程度继续沟通，不急于扩展新技术栈。',
      '区分对方明确反馈与自己的推测，保留缓冲时间。',
    ],
    outcome: '一张求职反馈表或一次模拟复盘。',
  },
  {
    title: '复习案例的高频追问',
    actions: ['三个主案例各脱稿讲一次。', '围绕替代方案、验证与不足展开追问。'],
    outcome: '三个案例的讲解记录与最后修订。',
  },
  {
    title: '回顾并决定下一阶段',
    actions: [
      '回顾岗位匹配、履历证据与实际面试反馈。',
      '只选一个新的主攻缺口，必要时调整岗位范围。',
    ],
    outcome: '下一阶段的一个明确目标。',
  },
]

export const planTasks: PlanTask[] = taskContent.map((task, index) => ({
  ...task,
  id: `unity-week-${String(index + 1).padStart(2, '0')}`,
  week: index + 1,
  phase: Math.floor(index / 4),
}))

export const planCases: PlanCase[] = [
  {
    id: 'unity-case-gameplay',
    title: '玩法与关卡工具',
    description: '从一次输入到结算，解释规则、状态与工具的设计。',
    prompts: [
      '逻辑更新与动画完成如何协调？',
      '搜索预算耗尽是否等于关卡无解？',
      '哪些规则和工具由你负责，怎样验证？',
    ],
  },
  {
    id: 'unity-case-system',
    title: 'Unity 系统与框架',
    description: '选择 UI 或奖励调度，讲清宿主边界与生命周期。',
    prompts: [
      '谁拥有状态、订阅与资源，何时释放？',
      '重开后旧回调返回，怎样隔离？',
      '为什么采用这项设计，有什么代价？',
    ],
  },
  {
    id: 'unity-case-performance',
    title: '真机性能与稳定性',
    description: '用可复现过程和原始记录支撑一次排查结论。',
    prompts: [
      '设备、构建方式和操作步骤是否一致？',
      '什么证据支持根因，排除了什么解释？',
      '修改有什么结果，怎样做回归？',
    ],
    projectId: 'unity-mobile-game-performance',
    articleIds: [
      'unity-mobile-performance-playbook',
      'unity-android-frame-pacing-case',
      'unity-pooling-lifecycle-regression',
    ],
  },
  {
    id: 'unity-case-delivery',
    title: '插件与版本交付',
    description: '作为备用案例，展示移动端适配与多项目交付能力。',
    prompts: [
      '原有 SDK 与你负责的封装如何区分？',
      '源码不变但依赖变化，是否需要发布？',
      '部分发布失败时如何追踪和恢复？',
    ],
  },
]

export const taskPlaceholder =
  '本周问题：\n我的职责：\n读到或测到的证据：\n结论与适用边界：\n还不确定的地方：\n下次行动：'
export const casePlaceholder =
  '背景与目标：\n代码来源与我的职责：\n问题与约束：\n方案和取舍：\n验证步骤与原始记录：\n结果、不足与后续：'
