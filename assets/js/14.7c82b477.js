(window.webpackJsonp=window.webpackJsonp||[]).push([[14],{394:function(t,s,a){"use strict";a.r(s);var n=a(28),e=Object(n.a)({},(function(){var t=this,s=t.$createElement,a=t._self._c||s;return a("ContentSlotsDistributor",{attrs:{"slot-key":t.$parent.slotKey}},[a("h2",{attrs:{id:"哈希表"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#哈希表"}},[t._v("#")]),t._v(" 哈希表")]),t._v(" "),a("h3",{attrs:{id:"什么是哈希表"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#什么是哈希表"}},[t._v("#")]),t._v(" 什么是哈希表")]),t._v(" "),a("p",[t._v("哈希表（Hash table，也叫散列表），是根据关键码值(Key value)而直接进行访问的数据结构。也就是说，它通过把关键码值映射到表中一个位置来访问记录，以加快查找的速度。这个映射函数叫做散列函数，存放记录的数组叫做散列表(哈希表)。")]),t._v(" "),a("ol",[a("li",[a("strong",[t._v("可以根据一个 key 值来直接访问数据，因此查找速度快")])]),t._v(" "),a("li",[a("strong",[t._v("哈希表是一个数据结构")])]),t._v(" "),a("li",[a("strong",[t._v("哈希表本质上是一个数组")]),t._v(" 底层是用数组实现的")]),t._v(" "),a("li",[t._v("实现哈希表我们可以采用两种方法：数组 + 链表 ； 数组 + 二叉树")])]),t._v(" "),a("ul",[a("li",[t._v("第一种数组+链表的形式，本质上是出现哈希冲突的一种解决办法，使用链表存放，所以综合起来叫做数组+链表的方式来实现一个哈希表，另外数组中一般就是存放的单一的数据，而哈希表中存放的是一个键值对")])]),t._v(" "),a("h3",{attrs:{id:"js-模拟实现-hashtable"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#js-模拟实现-hashtable"}},[t._v("#")]),t._v(" JS 模拟实现 HashTable")]),t._v(" "),a("p",[t._v("通过构造函数，ES6 中的 Map 实例来实现 HashTable")]),t._v(" "),a("div",{staticClass:"language-js extra-class"},[a("pre",{pre:!0,attrs:{class:"language-js"}},[a("code",[a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("HashTable")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 创建对象用于接受键值对")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("var")]),t._v(" map "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("new")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token class-name"}},[t._v("Map")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 添加关键字，无返回值")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("add")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(",")]),t._v(" value")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("//判断哈希表中是否存在key，若不存在，赋值")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// if (!this.hasKey(key)) {")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("//   map.set(key, value)")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// }")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 存在 则需要处理hash冲突， 这里直接覆盖")]),t._v("\n\t\tmap"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("set")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(",")]),t._v(" value"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 删除关键字, 如果哈希表中包含key，并且delete返回true则删除")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("remove")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("key")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("delete")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 哈希表中是否包含key，返回一个布尔值")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("hasKey")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("key")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("get")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 哈希表中是否包含value，返回一个布尔值")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("hasValue")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("value")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("get")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("===")]),t._v(" value\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 根据键获取value,如果不存在就返回null")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("getValue")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("key")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("hasKey")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("?")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("get")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("key"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v(":")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("null")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 获取哈希表中的所有value, 返回一个数组")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("getAllValues")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("var")]),t._v(" values "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("[")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("]")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("for")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("let")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("[")]),t._v("_"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(",")]),t._v(" value"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("]")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("of")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t\tvalues"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("push")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("value"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" values\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 根据值获取哈希表中的key，如果不存在就返回null")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("getKey")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("value")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("for")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("let")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("[")]),t._v("k"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(",")]),t._v(" v"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("]")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("of")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("if")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("v "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("===")]),t._v(" value"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" k\n\t\t\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 遍历结束没有return，就返回null")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("null")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 获取哈希表中所有的key,返回一个数组")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("getAllKeys")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("var")]),t._v(" keys "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("[")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("]")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("for")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("let")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("[")]),t._v("k"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(",")]),t._v(" _"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("]")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("of")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t\tkeys"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("push")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("k"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" keys\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 获取哈希表中记录的条数，返回一个数值")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("getSize")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("return")]),t._v(" map"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),t._v("size\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n\n\t"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// 清空哈希表，无返回值")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("this")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function-variable function"}},[t._v("clear")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\t\tmap"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("clear")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v("\n\t"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n")])])]),a("h2",{attrs:{id:"http-请求"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#http-请求"}},[t._v("#")]),t._v(" HTTP 请求")]),t._v(" "),a("h3",{attrs:{id:"http-请求状态码"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#http-请求状态码"}},[t._v("#")]),t._v(" HTTP 请求状态码")]),t._v(" "),a("h4",{attrs:{id:"常用状态码"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#常用状态码"}},[t._v("#")]),t._v(" 常用状态码")]),t._v(" "),a("ul",[a("li",[t._v("200 - 请求成功")]),t._v(" "),a("li",[t._v("301 - 资源（网页等）被永久转移到其它 URL")]),t._v(" "),a("li",[t._v("404 - 请求的资源（网页等）不存在")]),t._v(" "),a("li",[t._v("500 - 内部服务器错误")])]),t._v(" "),a("h4",{attrs:{id:"分类"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#分类"}},[t._v("#")]),t._v(" 分类")]),t._v(" "),a("ul",[a("li",[t._v("100 - 客户端请求继续")]),t._v(" "),a("li",[t._v("101 - 切换更高的协议")]),t._v(" "),a("li",[t._v("200 - 请求成功")]),t._v(" "),a("li",[t._v("201 - 请求成功并创建了新的资源")]),t._v(" "),a("li",[t._v("202 - 请求已接受，但未完成处理")]),t._v(" "),a("li",[t._v("203 - 请求成功，非授权的信息")]),t._v(" "),a("li",[t._v("204 - 请求成功，无内容返回")]),t._v(" "),a("li",[t._v("205 - 请求成功，客户端需重置内容")]),t._v(" "),a("li",[t._v("206 - 请求成功，服务端处理了部分 GET 请求")]),t._v(" "),a("li",[t._v("300 - 请求的资源包含多种选择")]),t._v(" "),a("li",[t._v("301 - 请求重定向，永久移动")]),t._v(" "),a("li",[t._v("302 - 请求重定向，临时移动")]),t._v(" "),a("li",[t._v("303 - 请求重定向，查看其它地址，使用 GET 和 POST 时查看")]),t._v(" "),a("li",[t._v("304 - 请求的资源未修改，服务器返回此状态码时，不会返回任何资源，客户端会访问缓存资源")]),t._v(" "),a("li",[t._v("305 - 代理请求")]),t._v(" "),a("li",[t._v("400 - 客户端请求的语法错误，服务器无法理解")]),t._v(" "),a("li",[t._v("401 - 请求要求用户的身份认证")]),t._v(" "),a("li",[t._v("403 - 服务器理解请求客户端的请求，但是拒绝执行此请求")]),t._v(" "),a("li",[t._v("404 - 未找到资源")]),t._v(" "),a("li",[t._v("405 - 客户端请求中的方法被禁止")]),t._v(" "),a("li",[t._v("406 - 服务器无法根据客户端请求的内容特性完成请求")]),t._v(" "),a("li",[t._v("407 - 请求要求代理的身份认证")]),t._v(" "),a("li",[t._v("408 - 请求时间过长，超时")]),t._v(" "),a("li",[t._v("409 - 服务器完成客户端的 PUT 请求时可能返回此代码，服务器处理请求时发生了冲突")]),t._v(" "),a("li",[t._v("410 - 客户端请求的资源已经不存在")]),t._v(" "),a("li",[t._v("411 - 服务器无法处理客户端发送的不带 Content-Length 的请求信息")]),t._v(" "),a("li",[t._v("412 - 客户端请求信息的先决条件错误")]),t._v(" "),a("li",[t._v("413 - 请求的实体过大，服务器无法处理，因此拒绝请求")]),t._v(" "),a("li",[t._v("414 - 请求的 URI 过长（URI 通常为网址），服务器无法处理")]),t._v(" "),a("li",[t._v("415 - 服务器无法处理请求附带的媒体格式")]),t._v(" "),a("li",[t._v("416 - 客户端请求的范围无效")]),t._v(" "),a("li",[t._v("417 - 服务器无法满足 Expect 的请求头信息")]),t._v(" "),a("li",[t._v("500 - 服务器内部错误，无法完成请求")]),t._v(" "),a("li",[t._v("501 - 服务器不支持请求的功能，无法完成请求")]),t._v(" "),a("li",[t._v("502 - 作为网关或者代理工作的服务器尝试执行请求时，从远程服务器接收到了一个无效的响应")]),t._v(" "),a("li",[t._v("505 - 服务器不支持请求的 HTTP 协议的版本，无法完成处理")])]),t._v(" "),a("h3",{attrs:{id:"restful-规范及其理解"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#restful-规范及其理解"}},[t._v("#")]),t._v(" Restful 规范及其理解")]),t._v(" "),a("p",[t._v("REST 是 Representational State Transfer 的缩写，翻译是”表现层状态转化”（表述形式的状态转换）。 可以总结为一句话：REST 是所有 Web 应用都应该遵守的架构设计指导原则。\n面向资源是 REST 最明显的特征，对于同一个资源的一组不同的操作。资源是服务器上一个可命名的抽象概念，资源是以名词为核心来组织的，首先关注的是名词。REST 要求，必须通过统一的接口来对资源执行各种操作。对于每个资源只能执行一组有限的操作。")]),t._v(" "),a("p",[a("strong",[t._v("Restful 架构")])]),t._v(" "),a("ul",[a("li",[t._v("每个 URL 代表一种资源；")]),t._v(" "),a("li",[t._v("客户端和服务器之间，传递这种资源的某种表现层；")]),t._v(" "),a("li",[t._v('客户端通过四个 HTTP 动词，对服务器端资源进行操作，实现"表现层状态转化"。')])]),t._v(" "),a("p",[t._v("7 个 HTTP 方法：GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS")]),t._v(" "),a("h3",{attrs:{id:"get-请求-和-post-请求的区别"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#get-请求-和-post-请求的区别"}},[t._v("#")]),t._v(" Get 请求 和 Post 请求的区别")]),t._v(" "),a("ol",[a("li",[t._v("Get 是不安全的，因为在传输过程，数据被放在请求的 URL 中；Post 的所有操作对用户来说都是不可见的")]),t._v(" "),a("li",[t._v("Get 传送的数据量较小，这主要是因为受 URL 长度限制；Post 传送的数据量较大，一般被默认为不受限制")]),t._v(" "),a("li",[t._v("Get 限制 Form 表单的数据集的值必须为 ASCII 字符；而 Post 支持整个 ISO10646 字符集")]),t._v(" "),a("li",[t._v("Get 执行效率却比 Post 方法好。Get 是 form 提交的默认方法")])])])}),[],!1,null,null,null);s.default=e.exports}}]);