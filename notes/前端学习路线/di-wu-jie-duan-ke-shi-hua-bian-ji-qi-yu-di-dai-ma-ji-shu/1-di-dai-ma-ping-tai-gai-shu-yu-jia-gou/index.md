---
url: >-
  /my_notes/notes/前端学习路线/di-wu-jie-duan-ke-shi-hua-bian-ji-qi-yu-di-dai-ma-ji-shu/1-di-dai-ma-ping-tai-gai-shu-yu-jia-gou/index.md
---
# 低代码平台概述与架构

## 什么是低代码 / 无代码

**低代码（Low-Code）** 是一种通过可视化配置、少量手写代码即可完成应用开发的方式。与之对应的 **无代码（No-Code）** 则完全不写代码，适合更简单的场景。

| 维度 | 低代码 | 无代码 |
|:-----|:-------|:-------|
| 目标用户 | 有编程基础的开发者 | 业务人员 / 运营 |
| 灵活度 | 高，可手写代码扩展 | 低，受限于平台能力 |
| 典型场景 | 企业后台、表单审批、数据大屏 | 简单表单、问卷、页面搭建 |
| 代表平台 | LowCodeEngine、Retool、Appsmith | Amis、简道云、明道云 |

低代码平台的核心价值：**降低重复性开发成本**，让开发者专注于业务逻辑而非 UI 胶水代码。

## 低代码平台核心架构

一个典型的低代码平台分为三层：

```
┌─────────────────────────────────────┐
│           可视化编辑器 (Editor)        │
│  组件面板 │ 画布 │ 属性面板 │ 工具栏    │
├─────────────────────────────────────┤
│           DSL / Schema 层            │
│  JSON 描述 → 组件树 + 属性 + 数据绑定  │
├─────────────────────────────────────┤
│           渲染引擎 (Runtime)          │
│  Schema → React 组件树 → 真实 DOM      │
└─────────────────────────────────────┘
```

* **编辑器层**：提供拖拽、配置、预览等可视化操作界面
* **DSL / Schema 层**：用 JSON 数据描述页面结构，是编辑器与渲染引擎之间的"合约"
* **渲染引擎层**：解释 Schema，映射到真实的 React 组件并挂载

## 核心概念：Schema 驱动渲染

低代码的核心思想可以用一个公式概括：

```
UI = f(Schema)
```

Schema 是一棵用 JSON 描述的组件树。一个最简单的 Schema 示例：

```json
{
  "componentName": "Button",
  "props": {
    "type": "primary",
    "label": "提交"
  }
}
```

渲染引擎的工作就是把这个 JSON 映射成真实的 React 组件：

```tsx
// 简化的渲染逻辑
function SchemaRenderer({ schema }) {
  const Component = registry[schema.componentName];
  if (!Component) return null;
  return <Component {...schema.props}>{renderChildren(schema.children)}</Component>;
}
```

## DSL 与元数据设计

每个可被低代码平台使用的组件，都需要注册 **元数据（Metadata）**：

```ts
interface ComponentMeta {
  componentName: string;   // 唯一标识，如 "AntdButton"
  title: string;           // 显示名称，如 "按钮"
  icon: string;            // 图标
  category: string;        // 分类：基础组件 / 布局组件 / 表单组件
  defaultSchema: object;   // 拖入画布时的默认 Schema
  propertySchema: object;  // 属性面板的配置描述（字段列表 + 类型）
}
```

平台维护一个组件注册表（Registry），编辑器和渲染引擎都从注册表中读取组件信息。

## React 在低代码中的角色

React 成为低代码平台首选技术栈的原因：

1. **组件模型天然契合**：React 组件是 Schema 节点的最佳映射目标，props 对应 Schema 中的属性
2. **JSX 灵活组合**：可以通过 `createElement` 或 JSX 动态创建组件树，无需模板编译
3. **生态丰富**：antd、Material UI 等成熟 UI 库可直接作为低代码组件源
4. **虚拟 DOM 适合动态渲染**：Schema 变更后通过 state 更新即可触发重渲染，无需手动操作 DOM
5. **社区主流**：阿里 LowCodeEngine、百度 Amis 等主流低代码平台均以 React 为基础

## 本阶段学习路线

```
概念入门（5.1）
    │
    ├── 核心原语：拖拽（5.2）
    ├── 核心原语：Schema 渲染（5.3）
    │
    ├── 应用一：表单引擎（5.4）
    │
    ├── 页面编辑器架构（5.5）
    ├── 页面编辑器实战（5.6）
    │
    ├── 专项：富文本编辑器（5.7）
    ├── 专项：流程图编辑器（5.8）
    │
    ├── 生态与平台案例（5.9）
    └── 预览发布与沙箱（5.10）
```

完成本阶段后，你将能够独立搭建一个具备拖拽布局、属性配置、Schema 渲染、预览发布能力的可视化编辑器原型。
