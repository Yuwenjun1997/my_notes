---
url: >-
  /my_notes/notes/前端学习路线/di-wu-jie-duan-ke-shi-hua-bian-ji-qi-yu-di-dai-ma-ji-shu/9-zi-ding-yi-di-dai-ma-zu-jian-yu-ping-tai-an-li/index.md
---
# 自定义低代码组件与平台案例

## 组件的低代码化改造

一个普通 React 组件要接入低代码平台，需要满足以下条件：

```tsx
// 改造前：普通 React 组件
function UserProfile({ userId }) {
  const user = useUser(userId);
  return (
    <div className="user-profile">
      <img src={user.avatar} />
      <h3>{user.name}</h3>
    </div>
  );
}

// 改造后：低代码兼容组件
function UserProfile({ userId, avatarSize = 48, showName = true, style }) {
  const user = useUser(userId);
  return (
    <div className="user-profile" style={style}>
      <img src={user.avatar} width={avatarSize} height={avatarSize} />
      {showName && <h3>{user.name}</h3>}
    </div>
  );
}
```

改造要点：

1. **属性扁平化**：所有配置项都通过 props 传入，不依赖外部 hook 或 context
2. **提供默认值**：每个 prop 都有合理的 default，保证拖入画布即可正常显示
3. **无副作用**：组件不应该依赖外部状态（如 Redux store），数据由 Schema 的 dataBinding 提供

## 组件注册与元数据规范

```ts
interface ComponentMeta {
  // 基本信息
  componentName: string;      // 唯一标识
  title: string;              // 中文显示名
  icon: React.ReactNode;      // 面板图标
  category: string;           // 分组：基础 | 布局 | 表单 | 数据展示 | 业务

  // 默认 Schema
  defaultSchema: Partial<SchemaNode>;

  // 属性面板配置
  propertySchema: PropertyField[];
}

interface PropertyField {
  key: string;                // 对应 props 的属性名
  label: string;              // 面板中显示的标签
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'json' | 'slot';
  defaultValue?: any;
  options?: { label: string; value: any }[];  // select 类型的选项
  group?: string;             // 属性分组（基础 | 样式 | 高级）
}

// 注册中心
class ComponentRegistry {
  private metaMap = new Map<string, ComponentMeta>();

  register(meta: ComponentMeta, component: React.ComponentType<any>) {
    this.metaMap.set(meta.componentName, { ...meta, component });
  }

  get(name: string) { return this.metaMap.get(name); }
  getAll() { return Array.from(this.metaMap.values()); }
  getByCategory(category: string) { return this.getAll().filter(m => m.category === category); }
}

// 使用
const registry = new ComponentRegistry();
registry.register({
  componentName: 'UserProfile',
  title: '用户头像',
  icon: <UserIcon />,
  category: '业务',
  defaultSchema: { componentName: 'UserProfile', props: { avatarSize: 48 } },
  propertySchema: [
    { key: 'avatarSize', label: '头像大小', type: 'number', defaultValue: 48 },
    { key: 'showName', label: '显示名称', type: 'boolean', defaultValue: true },
  ],
}, UserProfile);
```

## 属性面板与插槽机制

属性面板根据 `propertySchema` 自动生成编辑表单，`slot` 类型支持子节点拖入：

```tsx
function PropertyEditor({ propertySchema, values, onChange }) {
  // 按 group 分组显示
  const groups = groupBy(propertySchema, f => f.group || '基础');

  return (
    <div className="property-editor">
      {Object.entries(groups).map(([group, fields]) => (
        <div key={group} className="prop-group">
          <h5>{group}</h5>
          {fields.map(field => {
            if (field.type === 'slot') {
              return (
                <div key={field.key} className="slot-area">
                  <label>{field.label}</label>
                  <div className="slot-drop-zone" data-slot={field.key}>
                    拖入组件到此插槽
                  </div>
                </div>
              );
            }
            return (
              <div key={field.key} className="prop-field">
                <label>{field.label}</label>
                <FieldEditor field={field} value={values[field.key]}
                  onChange={v => onChange({ ...values, [field.key]: v })} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

插槽 Schema 示例——一个卡片组件支持 header / body / footer 三个插槽：

```json
{
  "componentName": "Card",
  "props": { "title": "我的卡片" },
  "slots": {
    "header": [],
    "body": [
      { "componentName": "Text", "props": { "content": "卡片内容" } }
    ],
    "footer": []
  }
}
```

## Amis 案例分析

百度 **Amis** 的核心思想：**JSON 配置即页面**。一个完整的后台页面只需一段 JSON：

```json
{
  "type": "page",
  "title": "用户管理",
  "body": {
    "type": "crud",
    "api": "/api/users",
    "columns": [
      { "name": "name", "label": "用户名" },
      { "name": "email", "label": "邮箱" },
      { "name": "status", "label": "状态", "type": "mapping", "map": {
        "active": "<span class='label label-success'>启用</span>",
        "inactive": "<span class='label label-danger'>禁用</span>"
      }}
    ]
  }
}
```

Amis 的架构要点：

* **渲染器映射**：100+ 内置组件，每种 type 对应一个 React 渲染器
* **插件机制**：自定义渲染器通过注册 ` amisOptions` 接入
* **优势**：后台表单类页面搭建极快，组件丰富
* **局限**：高度定制化的 UI 较难实现，样式定制成本高

## LowCodeEngine（阿里）案例分析

阿里 **LowCodeEngine** 是更接近"可视化搭建平台"的架构：

```
┌──────────────────────────────────────────┐
│                 编辑器主框架               │
├────────┬──────────────┬─────────────────┤
│ 面板    │   模拟器      │   Setter 面板   │
│ 组件树  │  渲染预览区    │   属性/样式/事件 │
├────────┴──────────────┴─────────────────┤
│               插件协议层                  │
├──────────────────────────────────────────┤
│          组件元数据 + Setter 注册          │
└──────────────────────────────────────────┘
```

核心设计：

* **Setter 系统**：每个组件对应一套 Setter（属性 Setter、样式 Setter、事件 Setter），Setter 本质是 React 表单组件
* **模拟器（Simulator）**：在 iframe 中渲染用户搭建的页面，与编辑器环境隔离
* **插件协议**：面板、工具栏、属性栏均通过插件注册，支持高度自定义

```ts
// LowCodeEngine 组件注册示例（概念）
import { materialRegistry, setterRegistry } from '@alilc/lowcode-engine';

materialRegistry.register({
  componentName: 'MyButton',
  title: '我的按钮',
  category: '基础组件',
  group: '精选',
  snippet: { // 拖入画布时的默认 Schema
    componentName: 'MyButton',
    props: { type: 'primary', children: '按钮' },
  },
  configure: {
    props: [
      { name: 'children', title: '按钮文字', setter: 'StringSetter' },
      { name: 'type', title: '按钮类型', setter: { componentName: 'SelectSetter', props: {
        options: [{ label: '主要', value: 'primary' }, { label: '默认', value: 'default' }]
      }}},
    ],
  },
});
```

## Retool / Appsmith 模式对比

| 维度 | Retool | Appsmith | Amis | LowCodeEngine |
|:-----|:-------|:---------|:-----|:-------------|
| 开源 | 商业 | 开源 | 开源 | 开源 |
| 数据源优先 | 是（连接数据库/API） | 是 | 否（页面优先） | 否（组件优先） |
| 组件生态 | 60+ 组件 | 45+ 组件 | 100+ 组件 | 依赖 antd |
| 自定义组件 | 支持（React） | 支持（React） | 支持（渲染器） | 支持（React） |
| 部署方式 | SaaS / 自托管 | 自托管 | 嵌入式 | 嵌入式 |
| 适合场景 | 内部工具 | 内部工具 | 后台页面快速搭建 | 通用低代码平台 |

共同趋势：**数据源连接能力 + 组件市场 + 自定义扩展** 是现代低代码平台的三大支柱。
