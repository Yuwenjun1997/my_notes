---
url: >-
  /my_notes/notes/前端学习路线/di-yi-jie-duan-wang-ye-ji-chu/4-css-bu-ju-flex-yu-grid/index.md
---
# CSS 布局：flex 与 grid

现代布局主要用 Flexbox 与 Grid 两套体系。**Flex 擅长一维布局**（一行或一列内对齐），**Grid 擅长二维布局**（行列同时控制）。先用 flex 解决大多数排版，复杂网格再上 grid。

## flex 布局基础

给容器设 `display: flex`，其直接子元素沿主轴排列：

```css
.nav {
  display: flex;
  justify-content: space-between; /* 主轴对齐：flex-start/center/space-between/space-around */
  align-items: center;            /* 交叉轴对齐：flex-start/center/stretch/baseline */
  flex-direction: row;            /* 主轴方向：row(默认)/column/row-reverse/column-reverse */
  gap: 12px;                      /* 子元素间距 */
}
```

* **主轴**：`flex-direction` 决定，默认水平。
* **交叉轴**：与主轴垂直。
* `flex-wrap: wrap`：允许子项换行。

### 子项的伸缩

```css
.item {
  flex: 1;            /* 简写 = flex-grow:1 flex-shrink:1 flex-basis:0% */
}
.item-fixed {
  flex: 0 0 200px;    /* 不伸缩，固定 200px */
}
```

* `flex-grow`：剩余空间如何按比例分配（占满容器的关键）。
* `flex-shrink`：空间不足时如何收缩。
* `flex-basis`：分配剩余空间前的基准尺寸。

### 经典布局示例

**水平垂直居中：**

```css
.center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;   /* 撑满视口高度 */
}
```

**等分卡片：**

```css
.cards {
  display: flex;
  gap: 16px;
}
.cards > .card {
  flex: 1;   /* 每张卡片均分剩余空间并等宽 */
}
```

**两栏：侧栏固定 + 主内容自适应**

```css
.layout {
  display: flex;
}
.sidebar {
  flex: 0 0 240px;
}
.main {
  flex: 1;   /* 吃掉剩余宽度 */
}
```

## grid 布局

```css
.grid {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;  /* 三列：固定 + 两份弹性 */
  grid-template-rows: auto 300px;
  gap: 16px;
}
```

* `fr`：按比例分配剩余空间，`1fr 1fr` = 两等分。
* `repeat(3, 1fr)`：等价于 `1fr 1fr 1fr`。
* `gap` / `row-gap` / `column-gap`：间距。
* `grid-template-areas`：用命名区域排版，直观描述整体布局。

```css
.page {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
}
.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.footer  { grid-area: footer; }
```

### 元素如何占位

```css
.item {
  grid-column: 1 / 3;   /* 从第1条列线到第3条列线，占据两列 */
  grid-row: 2 / 4;      /* 占据两行 */
}
/* 等价简写 spanning：grid-column: span 2; */
```

## 定位：position

| 取值 | 说明 |
|:-----|:-----|
| `static` | 默认，正常文档流 |
| `relative` | 相对自身原位置偏移，不脱离文档流 |
| `absolute` | 相对最近的非 static 祖先定位，脱离文档流 |
| `fixed` | 相对视口定位，脱离文档流（如悬浮按钮、吸顶导航） |
| `sticky` | 滚动到阈值前 relative、之后 fixed（吸顶） |

`relative` + `absolute` 是最常用的组合：父容器 `relative` 做参照系，内部元素 `absolute` 精确摆放。

## flex 还是 grid？

* 一行/一列内的对齐、均分、居中 → **flex**。
* 二维网格、需要跨行列占位 → **grid**。
* 两者可嵌套混用，没有冲突。

选择器的优先级、盒模型细节详见 `1.3-CSS基础与盒模型`，响应式适配见 `1.5-响应式与动画`。
