---
url: >-
  /my_notes/notes/前端学习路线/di-er-jie-duan-java-script-he-xin/6-dom-cao-zuo-yu-shi-jian/index.md
---
# DOM 操作与事件

DOM（Document Object Model）把 HTML 文档映射为内存中的树结构，JS 通过操作这棵树实现动态内容与交互。本节覆盖「查、增、改、删」与事件的捕获/冒泡机制。

## 文档对象模型

浏览器解析 HTML 生成 DOM 树：`document` 是根，`<html>`、`<body>`、具体标签依次成为节点。`window` 是全局对象，`document` 指当前文档。

## 查询元素

```js
document.getElementById('app');               // 按 id
document.querySelector('#app .btn');          // 任意 CSS 选择器，返回第一个
document.querySelectorAll('.item');           // 返回 NodeList（可用 forEach / 展开为数组）
element.querySelector('p');                   // 在子树内查找
element.closest('.card');                     // 从自身向上找最近匹配祖先
```

`querySelectorAll` 返回的是 NodeList 而非数组，可用 `Array.from()` 或 `[...nodes]` 转为数组后再用 map/filter。

## 创建、插入、删除节点

```js
const div = document.createElement('div');
div.textContent = '新内容';
div.className = 'card';
div.dataset.id = 123;               // 相当于 data-id="123"

container.appendChild(div);         // 追加到末尾
container.prepend(div);             // 插入到开头
container.insertBefore(div, ref);   // 插到 ref 前
container.insertAdjacentHTML('beforeend', '<span>HTML 片段</span>');

node.remove();                      // 删除自身
container.removeChild(node);        // 删除子节点
```

* 插入 HTML 片段用 `insertAdjacentHTML` 便捷但注意 XSS（内容来自用户时先转义）。
* 频繁插入大量节点建议先用 `DocumentFragment` 或字符串拼接后一次性插入，减少重排。

## 修改样式与类

```js
element.style.color = 'red';        // 内联样式
element.style.background = '#333';
element.style.cssText = 'top:0;left:0;';

element.classList.add('active');    // 增
element.classList.remove('active'); // 删
element.classList.toggle('active'); // 切换
element.classList.contains('active'); // 判断

element.setAttribute('disabled', '');
element.getAttribute('data-id');
element.removeAttribute('disabled');
```

优先用 `classList` 配合 CSS 类控制样式，避免大量内联样式。

## 事件：捕获与冒泡

事件传播分三阶段：**捕获（capture）→ 目标（target）→ 冒泡（bubble）**。默认监听在冒泡阶段触发。

```
捕获阶段：window → document → ... → 目标元素
冒泡阶段：目标元素 → ... → document → window  （默认监听在这里触发）
```

```js
element.addEventListener('click', handler);
element.addEventListener('click', handler, true);  // true 表示在捕获阶段触发
```

### 阻止传播与默认行为

```js
child.addEventListener('click', (e) => {
  e.stopPropagation();   // 阻止继续冒泡（父级收不到）
  // e.stopImmediatePropagation();  // 还阻止同元素上其它监听
});

form.addEventListener('submit', (e) => {
  e.preventDefault();    // 阻止默认行为（表单提交、链接跳转、复选框切换等）
});
```

## 事件委托

把监听器挂在共同父级上，利用冒泡处理所有子节点事件——动态新增的子元素也能被覆盖，且监听器数量少：

```js
list.addEventListener('click', (e) => {
  const item = e.target.closest('li');
  if (!item) return;                 // 点击的不是 li 就忽略
  console.log('点到：', item.dataset.id);
});
```

`event.target` 是实际触发元素，`event.currentTarget` 是挂监听的元素（list）。

## 常见事件速查

| 事件 | 触发时机 |
|:-----|:---------|
| `click` / `dblclick` | 单击/双击 |
| `mouseenter` / `mouseleave` | 鼠标进入/离开（不冒泡） |
| `input` | 输入内容变化（即时） |
| `change` | 失焦或确认后取值变化 |
| `focus` / `blur` | 聚焦/失焦（blur 不冒泡，用 focusout 可委托） |
| `submit` | 表单提交 |
| `keydown` / `keyup` | 键盘按下/抬起 |
| `scroll` | 滚动（注意高频，配防抖/节流） |
| `DOMContentLoaded` | DOM 树构建完成（图片等资源未加载完） |
| `load` | 所有资源加载完成 |

页面脚本尽量放在 `<body>` 末尾，或在 `DOMContentLoaded` 后再操作 DOM，避免「元素还没解析」的报错。

## 与框架的关系

Vue/React 等框架内部封装了 DOM 操作与事件系统，日常开发很少直接碰 DOM。但理解 DOM/事件机制，对调试框架渲染问题、写自定义指令/原生于组件依然至关重要。
