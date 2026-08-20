---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/5-react-xing-neng-you-hua-shi-zhan/index.md
---
# React性能优化实战

> 深入理解 React 的渲染机制，掌握性能优化的核心策略，包括 memo、useMemo、useCallback 的正确使用，虚拟列表实现，代码分割与懒加载，以及性能调试工具的使用。本文通过实战案例演示如何优化大数据量列表页面。

## React 渲染机制

### 何时触发重渲染

```jsx
// 触发重渲染的场景
function DemoComponent() {
  const [count, setCount] = useState(0);
  
  // 1. 状态更新
  const handleClick = () => {
    setCount(prev => prev + 1); // 触发重渲染
  };
  
  // 2. 父组件重渲染导致子组件重渲染
  useEffect(() => {
    // 每次父组件重渲染，这里都会执行
    console.log('组件已渲染');
  });
  
  // 3. Context 值变化
  const theme = useContext(ThemeContext); // 如果 Context 值变化，触发重渲染
  
  return (
    <div>
      <p>计数：{count}</p>
      <button onClick={handleClick}>增加</button>
    </div>
  );
}

// 不会触发重渲染的场景
function OptimizedComponent() {
  const [count, setCount] = useState(0);
  
  // ref 变化不会触发重渲染
  const ref = useRef(null);
  
  // 1. 直接修改 ref
  const handleClick = () => {
    ref.current = 'new value'; // 不触发重渲染
  };
  
  // 2. 使用普通对象存储可变数据
  const dataRef = useRef({ value: 0 });
  const updateData = () => {
    dataRef.current.value += 1; // 不触发重渲染
  };
  
  return (
    <div ref={ref}>
      <p>计数：{count}</p>
      <button onClick={handleClick}>修改 ref</button>
      <button onClick={() => setCount(c => c + 1)}>增加</button>
    </div>
  );
}
```

### React 18 自动批处理

```jsx
// React 18 之前：多次 setState 只在事件处理函数中批处理
function OldBehavior() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);
  
  const handleClick = () => {
    // 在事件处理函数中，多次 setState 只触发一次重渲染
    setCount(c => c + 1);
    setFlag(f => !f);
    // 只渲染一次
  };
  
  const handleAsyncClick = async () => {
    // 在异步函数中，每次 setState 都会触发重渲染
    setCount(c => c + 1); // 渲染一次
    await new Promise(resolve => setTimeout(resolve, 100));
    setFlag(f => !f); // 又渲染一次
  };
  
  return (
    <div>
      <p>计数：{count}，标志：{flag.toString()}</p>
      <button onClick={handleClick}>同步更新</button>
      <button onClick={handleAsyncClick}>异步更新</button>
    </div>
  );
}

// React 18 之后：自动批处理所有更新
function React18Behavior() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);
  
  const handleClick = () => {
    setCount(c => c + 1);
    setFlag(f => !f);
    // 只渲染一次（与之前相同）
  };
  
  const handleAsyncClick = async () => {
    // 在 React 18 中，异步函数中的多次 setState 也会批处理
    setCount(c => c + 1);
    await new Promise(resolve => setTimeout(resolve, 100));
    setFlag(f => !f);
    // 只渲染一次（新行为）
  };
  
  const handleClickOutsideReact = () => {
    // 原生事件处理函数中也会自动批处理
    setTimeout(() => {
      setCount(c => c + 1);
      setFlag(f => !f);
      // 只渲染一次
    }, 100);
  };
  
  return (
    <div>
      <p>计数：{count}，标志：{flag.toString()}</p>
      <button onClick={handleClick}>同步更新</button>
      <button onClick={handleAsyncClick}>异步更新</button>
      <button onClick={handleClickOutsideReact}>原生事件更新</button>
    </div>
  );
}
```

## React.memo / useMemo / useCallback 使用时机

| API | 用途 | 使用场景 | 注意事项 |
|-----|------|----------|----------|
| React.memo | 避免父组件重渲染导致子组件不必要的重渲染 | 纯展示组件、列表项组件 | 浅比较，复杂 props 需自定义比较函数 |
| useMemo | 缓存计算结果，避免重复计算 | 昂贵的计算、依赖其他状态的派生值 | 有开销，简单计算无需使用 |
| useCallback | 缓存函数引用，避免子组件因函数变化而重渲染 | 传递给 memo 组件的回调函数 | 配合 React.memo 使用才有意义 |

### React.memo 使用示例

```jsx
// ❌ 不必要的重渲染
function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => setCount(c => c + 1)}>增加</button>
      
      {/* 每次父组件重渲染，这里都会重渲染 */}
      <ExpensiveComponent name={name} />
    </div>
  );
}

// ✅ 使用 React.memo 避免不必要的重渲染
const ExpensiveComponent = React.memo(function ExpensiveComponent({ name }) {
  console.log('ExpensiveComponent 渲染');
  
  // 假设这是一个计算成本高的组件
  const result = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += i;
    }
    return sum;
  }, []);
  
  return (
    <div>
      <p>名称：{name}</p>
      <p>计算结果：{result}</p>
    </div>
  );
});

// 自定义比较函数
const OptimizedList = React.memo(
  function OptimizedList({ items, onItemClick }) {
    console.log('OptimizedList 渲染');
    
    return (
      <ul>
        {items.map(item => (
          <li key={item.id} onClick={() => onItemClick(item.id)}>
            {item.name}
          </li>
        ))}
      </ul>
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较逻辑
    // 返回 true 表示不需要重渲染
    // 返回 false 表示需要重渲染
    return (
      prevProps.items.length === nextProps.items.length &&
      prevProps.items.every((item, index) => 
        item.id === nextProps.items[index].id
      )
    );
  }
);
```

### useMemo 使用示例

```jsx
function ProductList({ products, searchTerm, sortOption }) {
  // ❌ 每次渲染都会重新计算
  const filteredProducts = products
    .filter(p => p.name.includes(searchTerm))
    .sort((a, b) => {
      if (sortOption === 'price') return a.price - b.price;
      if (sortOption === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  
  // ✅ 使用 useMemo 缓存计算结果
  const optimizedFilteredProducts = useMemo(() => {
    console.log('重新计算筛选结果');
    
    return products
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        switch (sortOption) {
          case 'price-asc':
            return a.price - b.price;
          case 'price-desc':
            return b.price - a.price;
          case 'name':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
  }, [products, searchTerm, sortOption]);
  
  return (
    <div>
      <p>找到 {optimizedFilteredProducts.length} 个产品</p>
      <ul>
        {optimizedFilteredProducts.map(product => (
          <li key={product.id}>
            {product.name} - ¥{product.price}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### useCallback 使用示例

```jsx
// ❌ 函数引用每次渲染都会变化
function Parent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  
  const handleItemClick = (itemId) => {
    console.log('点击了项目:', itemId);
    // 处理点击逻辑
  };
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>增加计数</button>
      
      {/* 每次父组件重渲染，handleItemClick 都会创建新的函数引用 */}
      {/* 导致 MemoizedChild 组件重渲染 */}
      <MemoizedChild items={items} onItemClick={handleItemClick} />
    </div>
  );
}

const MemoizedChild = React.memo(function MemoizedChild({ items, onItemClick }) {
  console.log('MemoizedChild 渲染');
  
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});

// ✅ 使用 useCallback 缓存函数引用
function OptimizedParent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  
  const handleItemClick = useCallback((itemId) => {
    console.log('点击了项目:', itemId);
    // 处理点击逻辑
  }, []); // 依赖为空，函数引用稳定
  
  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, { id: Date.now(), name: '新项目' }]);
  }, []);
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>增加计数</button>
      <button onClick={handleAddItem}>添加项目</button>
      
      {/* handleItemClick 引用稳定，MemoizedChild 不会因计数变化而重渲染 */}
      <MemoizedChild items={items} onItemClick={handleItemClick} />
    </div>
  );
}
```

## 虚拟列表

### react-window 实现

```jsx
import { FixedSizeList as List } from 'react-window';
import { useState, useRef, useCallback, useMemo } from 'react';

// 生成模拟数据
function generateItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    name: `项目 ${index + 1}`,
    description: `这是项目 ${index + 1} 的描述`,
    value: Math.floor(Math.random() * 1000)
  }));
}

// 列表项组件
const Row = React.memo(function Row({ index, style, data }) {
  const { items, onItemClick } = data;
  const item = items[index];
  
  return (
    <div 
      style={style} 
      className="list-item"
      onClick={() => onItemClick(item.id)}
    >
      <div className="item-header">
        <span className="item-index">#{index + 1}</span>
        <span className="item-name">{item.name}</span>
      </div>
      <p className="item-description">{item.description}</p>
      <div className="item-value">值：{item.value}</div>
    </div>
  );
});

// 虚拟列表组件
function VirtualList({ itemCount = 10000 }) {
  const [items] = useState(() => generateItems(itemCount));
  const listRef = useRef(null);
  
  const handleClickItem = useCallback((itemId) => {
    console.log('点击了项目:', itemId);
  }, []);
  
  const itemData = useMemo(() => ({
    items,
    onItemClick: handleClickItem
  }), [items, handleClickItem]);
  
  const scrollToTop = () => {
    listRef.current?.scrollToItem(0);
  };
  
  const scrollToItem = (index) => {
    listRef.current?.scrollToItem(index, 'center');
  };
  
  return (
    <div className="virtual-list-container">
      <div className="controls">
        <button onClick={scrollToTop}>回到顶部</button>
        <button onClick={() => scrollToItem(100)}>跳转到第 100 项</button>
        <span>共 {items.length} 项</span>
      </div>
      
      <List
        ref={listRef}
        height={600}
        itemCount={items.length}
        itemSize={120}
        width="100%"
        itemData={itemData}
      >
        {Row}
      </List>
    </div>
  );
}

export default VirtualList;
```

### @tanstack/react-virtual 实现

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useCallback, useMemo } from 'react';

// 动态高度的虚拟列表
function DynamicVirtualList({ items }) {
  const parentRef = useRef(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 估算行高
    overscan: 10
  });
  
  return (
    <div 
      ref={parentRef} 
      className="scroll-container"
      style={{ height: '600px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
            className="list-item"
          >
            <div className="item-content">
              <h3>{items[virtualRow.index].name}</h3>
              <p>{items[virtualRow.index].description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 网格虚拟列表
function VirtualGrid({ items, columnCount = 3 }) {
  const parentRef = useRef(null);
  
  const rowCount = Math.ceil(items.length / columnCount);
  
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5
  });
  
  return (
    <div 
      ref={parentRef}
      className="grid-container"
      style={{ height: '600px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const startItemIndex = rowIndex * columnCount;
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: '16px',
                padding: '0 16px'
              }}
            >
              {Array.from({ length: columnCount }, (_, colIndex) => {
                const itemIndex = startItemIndex + colIndex;
                const item = items[itemIndex];
                
                if (!item) return <div key={colIndex} />;
                
                return (
                  <div key={colIndex} className="grid-item">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 搜索和过滤优化
function SearchableVirtualList({ initialItems }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const parentRef = useRef(null);
  
  const filteredItems = useMemo(() => {
    let result = initialItems;
    
    // 搜索过滤
    if (searchTerm) {
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // 排序
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'value':
          return b.value - a.value;
        default:
          return 0;
      }
    });
    
    return result;
  }, [initialItems, searchTerm, sortBy]);
  
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10
  });
  
  return (
    <div className="searchable-list">
      <div className="controls">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索..."
        />
        
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">按名称排序</option>
          <option value="value">按值排序</option>
        </select>
        
        <span>共 {filteredItems.length} 项</span>
      </div>
      
      <div 
        ref={parentRef}
        className="scroll-container"
        style={{ height: '600px', overflow: 'auto' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = filteredItems[virtualRow.index];
            
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                className="list-item"
              >
                <div className="item-content">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="item-value">值：{item.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { VirtualList, DynamicVirtualList, VirtualGrid, SearchableVirtualList };
```

## 代码分割与懒加载

```jsx
import { lazy, Suspense, useState, useCallback } from 'react';

// 基础懒加载
const LazyComponent = lazy(() => import('./LazyComponent'));

// 带有错误边界的懒加载
const LazyComponentWithErrorBoundary = lazy(() => 
  import('./LazyComponent')
    .then(module => ({ default: module.default }))
    .catch(error => {
      console.error('加载失败:', error);
      return { default: () => <div>组件加载失败</div> };
    })
);

// 条件懒加载
function Dashboard({ activeTab }) {
  const [modules, setModules] = useState({});
  
  const loadModule = useCallback(async (tabName) => {
    if (modules[tabName]) return modules[tabName];
    
    let module;
    switch (tabName) {
      case 'analytics':
        module = await import('./Analytics');
        break;
      case 'users':
        module = await import('./UserManagement');
        break;
      case 'settings':
        module = await import('./Settings');
        break;
      default:
        return null;
    }
    
    setModules(prev => ({ ...prev, [tabName]: module.default }));
    return module.default;
  }, [modules]);
  
  const [Component, setComponent] = useState(null);
  
  useEffect(() => {
    loadModule(activeTab).then(setComponent);
  }, [activeTab, loadModule]);
  
  if (!Component) {
    return <div>加载中...</div>;
  }
  
  return <Component />;
}

// 路由级别的懒加载
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>页面加载中...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// 预加载
function Navigation() {
  const handleMouseEnter = (route) => {
    // 鼠标悬停时预加载
    switch (route) {
      case 'about':
        import('./pages/About');
        break;
      case 'contact':
        import('./pages/Contact');
        break;
    }
  };
  
  return (
    <nav>
      <Link to="/">首页</Link>
      <Link 
        to="/about"
        onMouseEnter={() => handleMouseEnter('about')}
      >
        关于
      </Link>
      <Link 
        to="/contact"
        onMouseEnter={() => handleMouseEnter('contact')}
      >
        联系
      </Link>
    </nav>
  );
}
```

## 性能调试工具

### React DevTools Profiler

```jsx
// 使用 Profiler 组件
import { Profiler } from 'react';

function onRenderCallback(
  id, // 发生提交的 Profiler 树的 "id"
  phase, // "mount"（首次挂载）或 "update"（重渲染）
  actualDuration, // 本次提交更新的渲染耗时
  baseDuration, // 估计不使用优化的情况下一次完整渲染的耗时
  startTime, // React 开始渲染本次更新的时间戳
  commitTime, // React 提交本次更新的时间戳
  interactions // 本次更新的 interactions 集合
) {
  // 记录性能数据
  console.log({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions: Array.from(interactions)
  });
  
  // 可以发送到分析服务
  if (actualDuration > 16) { // 超过一帧的时间
    console.warn(`组件 ${id} 渲染耗时过长: ${actualDuration}ms`);
  }
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Header />
      <Main />
      <Footer />
    </Profiler>
  );
}

// 多个 Profiler 嵌套
function Dashboard() {
  return (
    <div>
      <Profiler id="Header" onRender={onRenderCallback}>
        <Header />
      </Profiler>
      
      <Profiler id="Sidebar" onRender={onRenderCallback}>
        <Sidebar />
      </Profiler>
      
      <Profiler id="Content" onRender={onRenderCallback}>
        <Content />
      </Profiler>
    </div>
  );
}
```

### Chrome Performance 面板

```jsx
// 性能测试组件
function PerformanceTest() {
  const [items, setItems] = useState([]);
  const [renderTime, setRenderTime] = useState(0);
  
  const generateItems = (count) => {
    const startTime = performance.now();
    
    const newItems = Array.from({ length: count }, (_, index) => ({
      id: index,
      name: `项目 ${index + 1}`,
      value: Math.floor(Math.random() * 1000),
      timestamp: Date.now()
    }));
    
    setItems(newItems);
    
    // 使用 requestAnimationFrame 测量渲染时间
    requestAnimationFrame(() => {
      const endTime = performance.now();
      setRenderTime(endTime - startTime);
    });
  };
  
  const forceReRender = () => {
    // 强制重渲染
    setItems(prev => [...prev]);
  };
  
  return (
    <div>
      <h2>性能测试</h2>
      
      <div className="controls">
        <button onClick={() => generateItems(100)}>
          生成 100 项
        </button>
        <button onClick={() => generateItems(1000)}>
          生成 1,000 项
        </button>
        <button onClick={() => generateItems(10000)}>
          生成 10,000 项
        </button>
        <button onClick={forceReRender}>
          强制重渲染
        </button>
      </div>
      
      <p>渲染耗时：{renderTime.toFixed(2)}ms</p>
      <p>项目数量：{items.length}</p>
      
      <div className="item-list">
        {items.slice(0, 100).map(item => (
          <div key={item.id} className="item">
            {item.name}: {item.value}
          </div>
        ))}
        {items.length > 100 && (
          <p>...还有 {items.length - 100} 个项目</p>
        )}
      </div>
    </div>
  );
}
```

## 实战：优化一个大数据量列表页面的完整方案

```jsx
import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// 生成模拟数据
function generateData(count = 10000) {
  const statuses = ['pending', 'processing', 'completed', 'failed'];
  const priorities = ['low', 'medium', 'high'];
  
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    title: `任务 ${index + 1}`,
    description: `这是任务 ${index + 1} 的详细描述，包含一些额外的信息用于测试性能`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    assignee: `用户 ${Math.floor(Math.random() * 100) + 1}`,
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

// 优化的列表项组件
const TaskRow = memo(function TaskRow({ task, style, onStatusChange, onEdit }) {
  const handleStatusChange = useCallback(() => {
    onStatusChange(task.id);
  }, [task.id, onStatusChange]);
  
  const handleEdit = useCallback(() => {
    onEdit(task);
  }, [task, onEdit]);
  
  const statusColor = useMemo(() => {
    switch (task.status) {
      case 'completed': return '#10b981';
      case 'processing': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  }, [task.status]);
  
  const priorityColor = useMemo(() => {
    switch (task.priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  }, [task.priority]);
  
  return (
    <div style={style} className="task-row">
      <div className="task-checkbox">
        <input
          type="checkbox"
          checked={task.status === 'completed'}
          onChange={handleStatusChange}
        />
      </div>
      
      <div className="task-content">
        <div className="task-header">
          <h4 className={task.status === 'completed' ? 'completed' : ''}>
            {task.title}
          </h4>
          <span 
            className="status-badge"
            style={{ backgroundColor: statusColor }}
          >
            {task.status}
          </span>
          <span 
            className="priority-badge"
            style={{ backgroundColor: priorityColor }}
          >
            {task.priority}
          </span>
        </div>
        
        <p className="task-description">{task.description}</p>
        
        <div className="task-meta">
          <span>负责人：{task.assignee}</span>
          <span>创建时间：{new Date(task.createdAt).toLocaleDateString()}</span>
          <span>更新时间：{new Date(task.updatedAt).toLocaleString()}</span>
        </div>
      </div>
      
      <div className="task-actions">
        <button onClick={handleEdit} className="btn-edit">
          编辑
        </button>
        <button className="btn-delete">删除</button>
      </div>
    </div>
  );
});

// 搜索和过滤组件
const SearchFilter = memo(function SearchFilter({ 
  searchTerm, 
  onSearchChange, 
  statusFilter, 
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange 
}) {
  return (
    <div className="search-filter">
      <div className="search-box">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索任务..."
        />
      </div>
      
      <div className="filter-group">
        <select 
          value={statusFilter} 
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">所有状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
        </select>
        
        <select 
          value={priorityFilter} 
          onChange={(e) => onPriorityFilterChange(e.target.value)}
        >
          <option value="all">所有优先级</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>
    </div>
  );
});

// 统计信息组件
const StatsBar = memo(function StatsBar({ stats }) {
  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">总数</span>
        <span className="stat-value">{stats.total}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">待处理</span>
        <span className="stat-value pending">{stats.pending}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">处理中</span>
        <span className="stat-value processing">{stats.processing}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">已完成</span>
        <span className="stat-value completed">{stats.completed}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">失败</span>
        <span className="stat-value failed">{stats.failed}</span>
      </div>
    </div>
  );
});

// 主要的优化列表组件
function OptimizedTaskList() {
  const [tasks, setTasks] = useState(() => generateData(10000));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  
  const parentRef = useRef(null);
  
  // 使用 useMemo 缓存筛选逻辑
  const filteredTasks = useMemo(() => {
    console.log('重新计算筛选结果');
    
    let result = tasks;
    
    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(term) ||
        task.description.toLowerCase().includes(term) ||
        task.assignee.toLowerCase().includes(term)
      );
    }
    
    // 状态过滤
    if (statusFilter !== 'all') {
      result = result.filter(task => task.status === statusFilter);
    }
    
    // 优先级过滤
    if (priorityFilter !== 'all') {
      result = result.filter(task => task.priority === priorityFilter);
    }
    
    return result;
  }, [tasks, searchTerm, statusFilter, priorityFilter]);
  
  // 使用 useMemo 缓存统计数据
  const stats = useMemo(() => {
    const counts = {
      total: filteredTasks.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    filteredTasks.forEach(task => {
      counts[task.status]++;
    });
    
    return counts;
  }, [filteredTasks]);
  
  // 使用 useCallback 缓存事件处理函数
  const handleStatusChange = useCallback((taskId) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
        : task
    ));
  }, []);
  
  const handleEdit = useCallback((task) => {
    setSelectedTask(task);
  }, []);
  
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);
  
  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value);
  }, []);
  
  const handlePriorityFilterChange = useCallback((value) => {
    setPriorityFilter(value);
  }, []);
  
  // 使用 useVirtualizer 实现虚拟滚动
  const virtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160, // 估算行高
    overscan: 10 // 额外渲染的行数
  });
  
  return (
    <div className="optimized-task-list">
      <div className="header">
        <h1>任务列表</h1>
        <p>使用虚拟滚动优化的大数据量列表</p>
      </div>
      
      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={handlePriorityFilterChange}
      />
      
      <StatsBar stats={stats} />
      
      <div className="list-info">
        <p>显示 {filteredTasks.length} / {tasks.length} 项</p>
        <button onClick={() => setTasks(generateData(10000))}>
          重新生成数据
        </button>
      </div>
      
      <div 
        ref={parentRef}
        className="virtual-list-container"
        style={{ height: '600px', overflow: 'auto' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = filteredTasks[virtualRow.index];
            
            return (
              <TaskRow
                key={virtualRow.key}
                task={task}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
              />
            );
          })}
        </div>
      </div>
      
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>编辑任务</h2>
            <p>{selectedTask.title}</p>
            <button onClick={() => setSelectedTask(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptimizedTaskList;
```

## 要点总结

1. **渲染机制**：理解 React 18 自动批处理，避免不必要的状态更新
2. **React.memo**：用于纯展示组件，避免父组件重渲染导致子组件不必要的更新
3. **useMemo**：缓存昂贵计算结果，注意依赖数组的正确性
4. **useCallback**：缓存函数引用，配合 React.memo 使用才有意义
5. **虚拟列表**：大数据量必须使用，react-window 和 @tanstack/react-virtual 是主流选择
6. **代码分割**：路由级别和组件级别都要考虑懒加载
7. **性能调试**：使用 React DevTools Profiler 和 Chrome Performance 面板
8. **优化原则**：先测量，再优化，避免过早优化
