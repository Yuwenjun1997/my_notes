---
url: >-
  /my_notes/notes/前端学习路线/di-wu-jie-duan-ke-shi-hua-bian-ji-qi-yu-di-dai-ma-ji-shu/5-ke-shi-hua-ye-mian-bian-ji-qi-jia-gou/index.md
---
# 可视化页面编辑器架构

## 页面编辑器的核心模型

页面编辑器本质上是一个**状态机**：状态是 Schema 树，用户操作（拖拽、选中、配置、删除）产生 Schema 变更，变更触发画布重渲染。

```
用户操作 → State 更新 → Schema 变化 → 画布重渲染
   ↑                                    │
   └────────── 视觉反馈 ←──────────────┘
```

核心状态包括：

* `schema`：当前页面的完整 Schema 树
* `selectedNodeId`：当前选中的节点 ID
* `hoveredNodeId`：鼠标悬停的节点 ID
* `history`：撤销/重做操作栈
* `mode`：编辑模式 / 预览模式

## 四区布局架构

几乎所有可视化编辑器都采用相似的四区布局：

```
┌──────────────────────────────────────────────┐
│                  工具栏                        │
│       撤销 │ 重做 │ 预览 │ 保存 │ 设置        │
├────────┬─────────────────────┬───────────────┤
│        │                     │               │
│ 组件面板 │       画布区域       │   属性面板     │
│        │                     │               │
│ 按钮    │  ┌─────────────┐   │  标题: 按钮    │
│ 输入框  │  │  Button      │   │  类型: Primary │
│ 表格    │  │  [提交]      │   │  尺寸: 中      │
│ 图片    │  └─────────────┘   │               │
│ ...    │                     │               │
├────────┴─────────────────────┴───────────────┤
│                 Schema 树面板                 │
└──────────────────────────────────────────────┘
```

* **组件面板（左侧）**：展示所有可用组件，按分类组织，拖拽进入画布
* **画布区域（中间）**：渲染当前 Schema，支持选中、拖拽、缩放
* **属性面板（右侧）**：选中节点后，动态显示该组件可配置的属性表单
* **工具栏（顶部）**：全局操作——撤销/重做、预览/编辑切换、保存/发布

## 组件面板设计

组件面板从注册表读取所有组件元数据，分类展示：

```tsx
interface ComponentMeta {
  componentName: string;
  title: string;
  icon: React.ReactNode;
  category: '基础' | '布局' | '表单' | '数据展示';
  defaultSchema: SchemaNode;
  propertySchema: PropertyField[];  // 属性面板的字段定义
}

// 预设组件列表
const COMPONENT_CATALOG: ComponentMeta[] = [
  {
    componentName: 'Button',
    title: '按钮',
    icon: <ButtonIcon />,
    category: '基础',
    defaultSchema: {
      id: '',
      componentName: 'Button',
      props: { type: 'primary', label: '按钮' },
    },
    propertySchema: [
      { key: 'label', label: '按钮文字', type: 'string' },
      { key: 'type', label: '类型', type: 'select', options: ['primary', 'default', 'dashed'] },
      { key: 'size', label: '尺寸', type: 'select', options: ['large', 'middle', 'small'] },
      { key: 'disabled', label: '禁用', type: 'boolean' },
    ],
  },
  // ...更多组件
];
```

面板支持搜索和分类过滤：

```tsx
function ComponentPalette() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('基础');

  const filtered = COMPONENT_CATALOG.filter(c =>
    c.category === activeCategory && c.title.includes(search)
  );

  return (
    <div className="component-palette">
      <input placeholder="搜索组件..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="category-tabs">
        {['基础', '布局', '表单', '数据展示'].map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}>{cat}</button>
        ))}
      </div>
      <div className="component-list">
        {filtered.map(meta => (
          <DraggableComponent key={meta.componentName} meta={meta} />
        ))}
      </div>
    </div>
  );
}
```

## 属性面板设计

属性面板根据当前选中节点的组件类型，动态渲染对应的属性编辑器：

```tsx
function PropertyPanel({ selectedNode, schema, onChange }) {
  if (!selectedNode) {
    return <div className="empty-hint">请选择一个组件</div>;
  }

  // 从注册表获取该组件的属性定义
  const meta = getComponentMeta(selectedNode.componentName);

  function handlePropChange(key: string, value: any) {
    onChange({
      ...selectedNode,
      props: { ...selectedNode.props, [key]: value },
    });
  }

  return (
    <div className="property-panel">
      <h4>{meta.title} 属性</h4>
      {meta.propertySchema.map(field => (
        <PropertyField
          key={field.key}
          field={field}
          value={selectedNode.props?.[field.key]}
          onChange={v => handlePropChange(field.key, v)}
        />
      ))}
    </div>
  );
}

// 根据字段类型渲染不同的编辑器
function PropertyField({ field, value, onChange }) {
  switch (field.type) {
    case 'string':
      return <label>{field.label}<input value={value} onChange={e => onChange(e.target.value)} /></label>;
    case 'number':
      return <label>{field.label}<input type="number" value={value} onChange={e => onChange(+e.target.value)} /></label>;
    case 'boolean':
      return <label><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />{field.label}</label>;
    case 'select':
      return (
        <label>{field.label}
          <select value={value} onChange={e => onChange(e.target.value)}>
            {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
      );
    case 'color':
      return <label>{field.label}<input type="color" value={value} onChange={e => onChange(e.target.value)} /></label>;
    default:
      return null;
  }
}
```

## 撤销/重做与状态管理

编辑器的撤销/重做功能通过 **Command 模式** 实现：

```ts
interface Command {
  execute(): void;   // 执行操作
  undo(): void;      // 撤销操作
  description: string;
}

class UndoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];  // 新操作清空重做栈
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
    }
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
}

// 使用示例：修改属性的 Command
class UpdatePropsCommand implements Command {
  description = '修改组件属性';
  constructor(
    private schema: SchemaNode,
    private nodeId: string,
    private newProps: Record<string, any>,
    private oldProps: Record<string, any>,
  ) {}
  execute() { updateNodeProps(this.schema, this.nodeId, this.newProps); }
  undo() { updateNodeProps(this.schema, this.nodeId, this.oldProps); }
}
```

状态管理推荐方案：

| 工具 | 适用场景 |
|:-----|:---------|
| **Zustand** | 轻量，推荐用于编辑器全局状态 |
| **Immer** | 不可变更新，避免 Schema 拷贝性能问题 |
| Jotai | 原子化状态，适合大页面多区域独立更新 |

```ts
// Zustand + Immer 组合
import { create } from 'zustand';
import { produce } from 'immer';

interface EditorState {
  schema: SchemaNode;
  selectedNodeId: string | null;
  updateNodeProps: (nodeId: string, props: Record<string, any>) => void;
  selectNode: (nodeId: string | null) => void;
}

const useEditorStore = create<EditorState>((set) => ({
  schema: { id: 'root', componentName: 'Page', children: [] },
  selectedNodeId: null,
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  updateNodeProps: (nodeId, props) => set(produce((state: EditorState) => {
    const node = findNode(state.schema, nodeId);
    if (node) Object.assign(node.props, props);
  })),
}));
```

## 画布区域设计

画布区域的核心职责：

1. **渲染 Schema 树**：递归渲染所有 Schema 节点
2. **选中与高亮**：点击节点时设置 `selectedNodeId`，显示蓝色边框
3. **拖拽接收**：作为 dnd-kit 的 Droppable，接收从面板拖入的组件
4. **缩放与平移**：支持 zoom in/out 和画布拖拽移动

```tsx
function Canvas() {
  const { schema, selectedNodeId, selectNode } = useEditorStore();

  return (
    <div className="canvas-wrapper" onClick={() => selectNode(null)}>
      <div className="canvas-content" onClick={e => e.stopPropagation()}>
        {schema.children?.map(node => (
          <CanvasNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}

function CanvasNode({ node }: { node: SchemaNode }) {
  const { selectedNodeId, selectNode } = useEditorStore();
  const isSelected = selectedNodeId === node.id;

  return (
    <div
      className={`canvas-node ${isSelected ? 'selected' : ''}`}
      onClick={e => { e.stopPropagation(); selectNode(node.id); }}
      style={{ outline: isSelected ? '2px solid #1890ff' : 'none' }}
    >
      <SchemaRenderer schema={node} />
    </div>
  );
}
```
