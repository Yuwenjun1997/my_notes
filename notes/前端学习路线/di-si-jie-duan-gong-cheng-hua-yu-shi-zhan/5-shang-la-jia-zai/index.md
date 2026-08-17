---
url: >-
  /my_notes/notes/前端学习路线/di-si-jie-duan-gong-cheng-hua-yu-shi-zhan/5-shang-la-jia-zai/index.md
---
# 上拉加载

## 分析

首先要考虑 html 的结构

1. 一般上拉加载不会直接监听 window 的滚动事件，应该选择一个 div 作为滚动的容器，这里命名为 root
2. 还需要在 root 中添加一个存放具体内容的 div，方便获取内容区域的整体高度，这里命名为 content
3. 为 root 元素注册 scroll 事件，通过滚动来获取 root 元素的 scrollTop 的值，然后根据 scrollTop 的值和内容的高度来判断是否执行加载操作
4. 主要就是以上三点，具体思路往下看

## 开始封装-过程

这里我使用了 class 来创建 scrollView 对象

1. 首先我们需要把这个对象内可能用到的属性先给添加上去，（ps：能想到的、用到的、不会用到的全放上去就完事）

```javascript
//创建scrollView对象
class ScrollView {
	constructor(option) {} // 肯定是需要一个构造函数来初始化相关配置
	option: {} // 定义一个用来存放配置信息的对象
	root: null // 用来保存根元素
	content: null // 用来保存内容容器元素
	timeout: null // 保存定时器
	scrollTop: 0 // 保存root元素的scrollTop值
	refreshHeight: 0 // 保存content元素的高度
	isLoading: false // 是否可以触发加载的状态 true:可以加载  false:不可以加载
}
```

2. 还需要定义一些初始化属性的方法（有哪些属性需要初始化呢？）

```javascript
//我习惯定义一个初始化的入口函数
init(){}

//初始化root元素的方法
initRoot(){}

//初始化content的方法
initContent(){}

/*-------------------------------------*/
//还需要定义一些可能用到的工具函数 如：

//获取dom的方法
querySelector(){}

//设置scrollTop的方法
setScrollTop(){}

//获取高度的方法
getRefreshHeight(){}

//暂时就先这么多....后面应该还会有
```

3. 整个类的结构大概就这样，开始码代码啦！

```javascript
//创建scrollView对象
class ScrollView {
	// 构造函数，用来初始化配置，以及调用init对属性进行初始化
	constructor(option) {
		Object.assign(this.option, option)
		this.init()
	}
	// 默认样式
	style = {
		width: '100%',
		height: '300px',
		overflowY: 'scroll',
	}
	// 默认配置
	option = {
		el: '', // 根容器绑定的元素
		content: '', // 子容器绑定的元素
		delay: 200, // 防抖延迟 定时器执行的时间
		offset: 0, // 偏移量
		loading: null, // 用来接收一个匿名函数
		style: null, // 调用者传进来的样式
	}
	root = null // 根容器元素
	content = null // 内容容器元素 所有的内容都应该放在这个容器里面
	timeout = null // 定时器
	scrollTop = 0 // 滚动距离
	isLoading = false // 是否可加载
	refreshHeight = 0 // 可刷新的高度

	// 初始化
	init() {
		this.initRoot()
		this.initContent()
	}
	// 初始化根元素
	initRoot() {
		this.root = this.querySelector(this.option.el)
		Object.assign(this.style, this.option.style)
		Object.assign(this.root.style, this.style)
		this.root.addEventListener('scroll', this.scrollHandle(this)) // 为root元素添加滚动监听 需要传递一个匿名函数
	}
	// 初始化子元素
	initContent() {
		const el = this.option.children
		this.content = el ? this.querySelector(el) : this.root.children[0]
		console.dir(this.content)
		this.setRefreshHeight()
	}
	// dom选择器
	querySelector(el) {
		return document.querySelector(el)
	}
	// 返回scroll事件触发的函数
	scrollHandle(self) {
		return function() {
			// 一个简单的防抖
			clearTimeout(self.timeout)
			self.timeout = setTimeout(function() {
				// 事件每触发一次都会重新获取scrollTop值
				self.setScrollTop()
				// 事件没触发一次也要重新过去content的高度
				self.setRefreshHeight()
				// 判断是否需要执行加载操作
				self.isLoadingHandle()
				// 执行loading
				self.loading(self.option.loading)
			}, self.option.delay)
		}
	}
	// 获取root元素的scrollTop值
	setScrollTop() {
		this.scrollTop = this.root.scrollTop
	}
	// 处理是否加载
	isLoadingHandle() {
		const height = this.refreshHeight - this.root.offsetHeight - this.option.offset
		if (this.scrollTop >= height) {
			this.isLoading = true
		} else {
			this.isLoading = false
		}
	}
	// 获取content的高度
	setRefreshHeight() {
		this.refreshHeight = this.content.offsetHeight
	}
	// 加载 传递一个回调函数
	loading(callback) {
		console.log('is scrolling....')
		//如果传递进来的参数是一个函数,就执行函数
		if (this.isLoading && callback instanceof Function) {
			callback(this.root, this.content)
		}
	}
}
```

## 使用

* 在 html 中使用

```html
<div class="root">
	<div class="content">
		<div>...内容</div>
	</div>
</div>

<!--引入scrollView.js-->
<script src="./js/scrollView.js"></script>
<script>
	new ScrollView({
		el: '.root',
		content: '.content', //默认为.root内的第一个子元素
		style: {
			height: '500px',
		},
		delay: 200, //加载延迟
		offset: 100, //滚动偏移
		loading: function(root, content) {
			console.log('is loading')
			//上拉加载逻辑写在这里
		},
	})
</script>
```

## 总结

以上只是最简单的上拉加载的实现，还有很多问题和需要完善的地方，在写这个 demo 时，对 JavaScript 的对象了解的其实并不是很透彻，包括利用 class 创建对象的规范不是很明确，以后再回来优化...
