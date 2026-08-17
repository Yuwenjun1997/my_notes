---
url: >-
  /my_notes/notes/前端学习路线/di-si-jie-duan-gong-cheng-hua-yu-shi-zhan/7-excel-biao-ge-jie-xi/index.md
---
# Excel表格解析

## 说明

使用技术：xlsx.js

基于webpack模块化开发，利用`xlsx.js`的`utils.sheet_to_json()`方法可以将工作表转为以第一行为key的json数组对象，然后通过`formatSheetsJsonToArray()`方法将json对象处理为后端接口可用数组对象。`xlsx.js`也提供了很多其它对Excel文件操作的方法。

链接：https://github.com/SheetJS/sheetjs

npm安装

```
npm i xlsx -S
```

## 代码

formatSheetsJsonToArray.js

```js
const keysMap = {
	name: '姓名',
	age: '年龄',
	grade: '年级',
	other: '其他',
}

/**
 * 将工作表JSON对象数组为合法的数组
 * @param {*} sheetJson 工作表JSON对象数组
 * @returns 工作表数据数组
 */
const formatSheetsJsonToArray = function (sheetJson) {
	const sheetArrayList = []
	for (const key in sheetJson) {
		sheetArrayList[key] = transformObjectKeys(sheetJson[key])
	}
	return sheetArrayList
}

/**
 * 将对象中的key按照keysMap中的关系进行转换
 * @param {object} obj 需要被处理对象
 */
const transformObjectKeys = function (obj) {
	let newObj = Object.create(null)
	for (const key in keysMap) {
		newObj[key] = obj[keysMap[key]] || ''
	}
	return newObj
}

export default formatSheetsJsonToArray
```

index.js

```js
import { read, utils } from 'xlsx'
import formatSheetsJsonToArray from './formatSheetsToArray'

const handleFile = function (e) {
	let files = e.target.files,
		f = files[0]
	let reader = new FileReader()
	reader.onload = function (e) {
		let workbook = read(e.target.result)
		doSomething(workbook)
	}
	reader.readAsArrayBuffer(f)
}

/**
 * 读取工作表成功后要做的事
 * @param {*} workbook 工作表对象
 */
const doSomething = function (workbook) {
	let sheet = null
    const allSheetArrayList = []
	for (const key in workbook.Sheets) {
		sheet = workbook.Sheets[key]
		if (!sheet['!ref']) continue
		const json = utils.sheet_to_json(workbook.Sheets[key])
		console.log(utils.sheet_to_html(workbook.Sheets[key]))
		const sheetArrayList = formatSheetsJsonToArray(json)
        allSheetArrayList.push(...sheetArrayList)
	}
    // TODO获取到数组对象后要做的事
    // ...
    console.log(allSheetArrayList)
}

const input_dom_element = document.querySelector('#input_dom_element')
input_dom_element.addEventListener('change', handleFile, false)
```

index.html

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Document</title>
	</head>
	<body>
		<input type="file" name="file" id="input_dom_element" />
		<script src="/assets/bundle.js"></script>
	</body>
</html>
```
