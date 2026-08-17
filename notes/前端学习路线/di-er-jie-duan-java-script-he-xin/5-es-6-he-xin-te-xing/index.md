---
url: >-
  /my_notes/notes/前端学习路线/di-er-jie-duan-java-script-he-xin/5-es-6-he-xin-te-xing/index.md
---
# ES6+ 核心特性

ES6+ 是对现代 JS 的集大成改革。本书它语言基础之外的高频语法，配合 `2.1` 的基础知识点构成完整的语言全貌。

## 解构赋值

```js
// 数组解构
const [a, b, ...rest] = [1, 2, 3, 4];
// a=1, b=2, rest=[3,4]

// 对象解构
const { name, age, level = 1 } = user;  // 默认值

// 重命名 + 解构函数参数
const { name: uname } = user;
function draw({ x = 0, y = 0 } = {}) { /* ... */ }
```

## 模板字符串与字符串扩展

```js
const name = 'Tom';
const msg = `你好，${name}！`;       // 插值
const multi = `
  多行
  字符串
`;

"hello".includes("ell");   // true
"abc".repeat(2);           // "abcabc"
"  x ".trim();             // "x"
str.startsWith("a");       // true
```

## 展开与剩余运算符

```js
// 展开：把数组/对象拆开
const arr = [1, 2, 3];
const copy = [...arr];            // 浅拷贝
const merged = [...arr, 4, 5];    // 拼接
const obj2 = { ...obj1, age: 20 }; // 浅拷贝并覆盖字段

// 剩余：收集（与展开同一符号，方向相反）
function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }
const [head, ...tail] = [1, 2, 3];
```

展开是**浅拷贝**：嵌套对象仍共享引用，深拷贝方案见第四阶段「常用工具函数」。

## Symbol、Map、Set、WeakMap/WeakSet

### Symbol

```js
const s1 = Symbol('desc');     // 唯一且不可变
const s2 = Symbol('desc');
s1 === s2;                     // false

const KEY = Symbol();
obj[KEY] = 42;                 // 对象私有/安全的键
```

### Map：任意类型可作键

```js
const m = new Map();
m.set('a', 1).set({}, 2);
m.get('a');            // 1
m.has('a');            // true
m.size;                // 2
m.delete('a');
m.forEach((v, k) => console.log(k, v));
```

### Set：去重集合

```js
const set = new Set([1, 2, 2, 3]);
[...set];              // [1, 2, 3]
set.add(4);
set.has(2);            // true
```

### WeakMap/WeakSet：弱引用

键只接受对象（WeakMap）且不对键产生强引用，对象可被垃圾回收，适合缓存、DOM 节点关联数据，避免内存泄漏。

## 模块化： import / export

现代项目以 ES Module 组织代码（浏览器与 Node 均支持）：

```js
// utils.js
export const VERSION = '1.0';
export function formatDate(d) { /* ... */ }
export default function log(msg) { /* ... */ }   // 默认导出（一个文件一个）

// main.js
import log, { VERSION, formatDate } from './utils.js';
import * as utils from './utils.js';
```

* 命名导出：花括号引入，名字必须一致（可 `as` 重命名）。
* 默认导出：`import xxx from`，名字随意。
* 循环依赖、动态导入：`import('./mod.js').then(m => m.run())`。

## 可选链与空值合并

```js
const street = user?.address?.street ?? '未知地址';
// == 
// user != null && user.address != null ? user.address.street : 兜底
items?.[0]?.name;      // 数组/索引访问也可以
fn?.();                // 函数存在才调用
```

## 其它常用语法糖

```js
// 逻辑赋值
let n = 0;
n ||= 10;      // n 为假值才赋 10
n ??= 20;      // n 为 null/undefined 才赋 20
n &&= fn();    // n 为真值才执行

// 数组 find/filter/map 等常用方法见 2.7-JavaScript数组

// 对象简写与计算属性
const k = 'key';
const obj = { name, [k]: 1, method() {} };
```
