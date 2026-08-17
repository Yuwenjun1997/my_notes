---
url: >-
  /my_notes/notes/前端学习路线/di-er-jie-duan-java-script-he-xin/2-han-shu-zuo-yong-yu-yu-bi-bao/index.md
---
# 函数、作用域与闭包

函数是 JS 的一等公民。理解作用域链与闭包，才能真正看懂函数式写法、框架源码与各种「看似魔法」的写法。

## 参数进阶

```js
function f(a = 1, b = 2) {      // 默认参数
  return a + b;
}

function g(...rest) {           // 剩余参数：收集所有实参为数组
  return rest.length;
}

function h() {
  return arguments.length;      // arguments：类数组，箭头函数里没有
}
```

* 默认参数在传入 `undefined` 时生效；传 `null` 不会触发默认值。
* `arguments` 不是真数组，需要用 `Array.from(arguments)` 或剩余参数代替。

## 词法作用域与作用域链

JS 采用**词法作用域**：函数能访问的变量在「写代码的位置」就已确定，不随调用位置变化。

```js
const x = 1;

function outer() {
  const x = 2;
  function inner() {
    console.log(x); // 2：从内向外逐层查找，最近一层生效
  }
  inner();
}
outer();
```

**作用域链**：每层函数向外找变量的链条就是作用域链。查找不到时抛 `ReferenceError`。

## 闭包：函数 + 词法环境

闭包指「函数与其创建时的词法环境的组合」。函数即使在定义它的作用域之外执行，仍能记住并访问外层变量：

```js
function counter() {
  let count = 0;
  return function () {
    count += 1;
    return count;
  };
}

const inc = counter();
inc(); // 1
inc(); // 2   // count 没有被回收，被 inc 记住
```

**内存认知**：闭包会让被引用的外层变量常驻内存，不被垃圾回收。合理的闭包省事，滥用会造成内存泄漏——不再需要时把引用置空或解除事件监听。

## 闭包典型场景

### 私有变量

```js
const wallet = (() => {
  let balance = 0;
  return {
    deposit(n) { balance += n; },
    query() { return balance; },
  };
})();
wallet.deposit(100);
wallet.query(); // 100，balance 外部拿不到
```

### 柯里化

```js
const add = a => b => a + b;
const add5 = add(5);
add5(3); // 8
```

### 防抖/节流雏形（完整实现见第四阶段「常用工具函数」）

```js
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
window.addEventListener('resize', debounce(handler, 200));
```

## IIFE：立即执行函数表达式

```js
(function () {
  // 立即执行，形成独立作用域，不污染全局
})();

// 箭头函数版本
(() => {
  const privateVar = 'x';
})();
```

ES Module 出现前，IIFE 是模拟模块隔离的主要手段；如今模块化（见 2.5）已能替代大部分场景，但 IIFE 在「立即初始化 + 内置私有状态」时仍很常用。

## 循环 + var 的闭包陷阱

```js
// 经典坑：var 是函数级作用域，所有 setTimeout 读到的都是同一个 i
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);  // 输出 3 3 3
}

// 用 let 修复（块级作用域，每轮独立绑定）
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);  // 输出 0 1 2
}

// 或再用一层闭包捕获 i
for (var i = 0; i < 3; i++) {
  ((j) => setTimeout(() => console.log(j), 0))(i);  // 0 1 2
}
```
