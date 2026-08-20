---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/2-react-hooks-jin-jie/index.md
---
# React Hooks进阶

> 深入理解 React Hooks 的实现原理和高级用法，掌握 Hook 调用规则、内置 Hook 的进阶特性，以及自定义 Hook 的设计模式。本文涵盖 useLayoutEffect、useImperativeHandle、useId 等现代 Hook，以及闭包陷阱等常见问题。

## Hook 调用规则与实现原理

### 调用规则

React Hooks 有两条核心规则，违反这些规则会导致难以调试的错误：

```jsx
// ✅ 正确：在函数组件顶层调用
function Component() {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  
  useEffect(() => {
    console.log('组件已挂载');
  }, []);
  
  return <div>{count}</div>;
}

// ❌ 错误：在条件语句中调用
function Component({ showCount }) {
  if (showCount) {
    const [count, setCount] = useState(0); // 错误！
  }
  
  return <div>组件</div>;
}

// ❌ 错误：在循环中调用
function Component({ items }) {
  for (let i = 0; i < items.length; i++) {
    const [value, setValue] = useState(items[i]); // 错误！
  }
  
  return <div>组件</div>;
}

// ❌ 错误：在嵌套函数中调用
function Component() {
  useEffect(() => {
    const [count, setCount] = useState(0); // 错误！
  }, []);
  
  return <div>组件</div>;
}
```

### 链表结构实现原理

React 内部使用链表（Linked List）来存储 Hook 状态。每次渲染时，React 按顺序遍历链表来获取 Hook 的状态。

```jsx
// React 内部简化实现（概念性代码）
let hooks = [];
let currentIndex = 0;

function useState(initialState) {
  const index = currentIndex++;
  
  // 首次渲染：创建 hook 节点
  if (!hooks[index]) {
    hooks[index] = {
      state: initialState,
      queue: []
    };
  }
  
  // 处理更新队列
  const hook = hooks[index];
  hook.queue.forEach(action => {
    hook.state = typeof action === 'function' 
      ? action(hook.state) 
      : action;
  });
  
  // 重置更新队列
  hook.queue = [];
  
  const setState = (action) => {
    hook.queue.push(action);
    // 触发重新渲染
    scheduleUpdate();
  };
  
  return [hook.state, setState];
}

function useEffect(callback, deps) {
  const index = currentIndex++;
  
  if (!hooks[index]) {
    hooks[index] = {
      deps: undefined,
      cleanup: undefined
    };
  }
  
  const hook = hooks[index];
  const prevDeps = hook.deps;
  
  // 依赖比较
  const hasChanged = !deps || !prevDeps || 
    deps.some((dep, i) => !Object.is(dep, prevDeps[i]));
  
  if (hasChanged) {
    // 执行清理函数
    if (hook.cleanup) {
      hook.cleanup();
    }
    
    // 执行 effect
    hook.cleanup = callback();
    hook.deps = deps;
  }
}
```

## useLayoutEffect vs useEffect

| 特性 | useEffect | useLayoutEffect |
|------|-----------|-----------------|
| 执行时机 | 浏览器完成绘制后异步执行 | DOM 更新后同步执行 |
| 阻塞渲染 | 否 | 是 |
| 适用场景 | 数据获取、订阅、日志 | DOM 测量、同步更新 |
| 服务端渲染 | 支持 | 不支持（需条件渲染） |
| 性能影响 | 较小 | 可能影响性能 |
| 调试难度 | 较难 | 较易 |

### useLayoutEffect 示例

```jsx
function Tooltip({ children, position }) {
  const tooltipRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // 使用 useLayoutEffect 测量 DOM
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      
      // 计算位置，确保不超出视口
      let x = position.x;
      let y = position.y;
      
      if (x + rect.width > window.innerWidth) {
        x = window.innerWidth - rect.width - 10;
      }
      
      if (y + rect.height > window.innerHeight) {
        y = position.y - rect.height - 10;
      }
      
      setTooltipPosition({ x, y });
    }
  }, [position]);

  // 同步更新 DOM，避免闪烁
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${tooltipPosition.x}px`;
      tooltipRef.current.style.top = `${tooltipPosition.y}px`;
    }
  }, [tooltipPosition]);

  return (
    <div className="tooltip-container">
      {children}
      <div
        ref={tooltipRef}
        className="tooltip"
        style={{
          position: 'absolute',
          left: 0,
          top: 0
        }}
      >
        提示内容
      </div>
    </div>
  );
}
```

### useEffect 示例

```jsx
function DataFetcher({ url }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 使用 useEffect 进行数据获取
  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(url);
        const result = await response.json();
        
        // 只在组件挂载时更新状态
        if (isMounted) {
          setData(result);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    fetchData();
    
    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [url]);

  // 订阅示例
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      console.log('收到事件:', event);
    });
    
    return unsubscribe;
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }
  
  return <div>{JSON.stringify(data, null, 2)}</div>;
}
```

## useImperativeHandle 暴露组件实例方法

```jsx
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

// 自定义输入框组件
const CustomInput = forwardRef(function CustomInput({ 
  type = 'text', 
  placeholder, 
  onChange,
  ...props 
}, ref) {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');

  // 暴露组件实例方法
  useImperativeHandle(ref, () => ({
    // 获取当前值
    getValue: () => value,
    
    // 设置值
    setValue: (newValue) => {
      setValue(newValue);
    },
    
    // 聚焦
    focus: () => {
      inputRef.current?.focus();
    },
    
    // 选择所有文本
    selectAll: () => {
      inputRef.current?.select();
    },
    
    // 清空
    clear: () => {
      setValue('');
      inputRef.current?.focus();
    }
  }), [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
  };

  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={handleChange}
      {...props}
    />
  );
});

// 使用示例
function Form() {
  const inputRef = useRef(null);
  const [currentValue, setCurrentValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 通过 ref 调用子组件方法
    const value = inputRef.current?.getValue();
    console.log('提交的值:', value);
    
    // 调用其他方法
    inputRef.current?.selectAll();
  };

  const handleClear = () => {
    inputRef.current?.clear();
    setCurrentValue('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <CustomInput
        ref={inputRef}
        placeholder="请输入内容"
        onChange={setCurrentValue}
      />
      
      <div>
        <p>当前值：{currentValue}</p>
        <button type="submit">提交</button>
        <button type="button" onClick={handleClear}>清空</button>
        <button 
          type="button" 
          onClick={() => inputRef.current?.focus()}
        >
          聚焦
        </button>
      </div>
    </form>
  );
}
```

## useId 生成唯一 ID

```jsx
import { useId, useState } from 'react';

// 表单字段组件
function FormField({ label, error, children }) {
  const id = useId();
  const errorId = useId();
  
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      
      {/* 克隆子元素并注入 id 和 aria 属性 */}
      {React.cloneElement(children, {
        id,
        'aria-describedby': error ? errorId : undefined,
        'aria-invalid': error ? true : undefined
      })}
      
      {error && (
        <span id={errorId} className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// 表单组件
function RegistrationForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  
  const [errors, setErrors] = useState({});
  
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空';
    }
    
    if (!formData.email) {
      newErrors.email = '邮箱不能为空';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }
    
    if (formData.password.length < 8) {
      newErrors.password = '密码至少8位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validate()) {
      console.log('表单数据:', formData);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="用户名" error={errors.username}>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => handleChange('username', e.target.value)}
        />
      </FormField>
      
      <FormField label="邮箱" error={errors.email}>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
        />
      </FormField>
      
      <FormField label="密码" error={errors.password}>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
        />
      </FormField>
      
      <button type="submit">注册</button>
    </form>
  );
}
```

## 自定义 Hook 设计原则与实战

### 设计原则

1. **以 `use` 开头**：遵循命名约定，便于 React 检查 Hook 规则
2. **单一职责**：每个 Hook 只解决一个问题
3. **返回值明确**：返回对象或数组，语义清晰
4. **参数可选**：提供合理的默认值
5. **支持清理**：在需要时返回清理函数

### useLocalStorage

```jsx
import { useState, useEffect } from 'react';

function useLocalStorage(key, initialValue) {
  // 获取初始值
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`读取 localStorage 失败 (${key}):`, error);
      return initialValue;
    }
  });

  // 当 key 或 storedValue 变化时，同步到 localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`写入 localStorage 失败 (${key}):`, error);
    }
  }, [key, storedValue]);

  // 监听其他标签页的变更
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error('解析 localStorage 数据失败:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setStoredValue];
}

// 使用示例
function App() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  const [language, setLanguage] = useLocalStorage('language', 'zh-CN');

  return (
    <div>
      <p>当前主题：{theme}</p>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        切换主题
      </button>
      
      <p>当前语言：{language}</p>
      <select 
        value={language} 
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="zh-CN">中文</option>
        <option value="en-US">English</option>
      </select>
    </div>
  );
}
```

### useDebounce

```jsx
import { useState, useEffect } from 'react';

function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 搜索组件示例
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (debouncedSearchTerm) {
      performSearch(debouncedSearchTerm);
    } else {
      setResults([]);
    }
  }, [debouncedSearchTerm]);

  const performSearch = async (term) => {
    setIsSearching(true);
    
    try {
      // 模拟 API 调用
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error('搜索失败:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="搜索..."
      />
      
      {isSearching && <div>搜索中...</div>}
      
      <ul>
        {results.map((result, index) => (
          <li key={index}>{result.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### useToggle

```jsx
import { useState, useCallback } from 'react';

function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue(prev => !prev);
  }, []);

  const setTrue = useCallback(() => {
    setValue(true);
  }, []);

  const setFalse = useCallback(() => {
    setValue(false);
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);

  return {
    value,
    toggle,
    setTrue,
    setFalse,
    reset
  };
}

// 使用示例
function Modal() {
  const { 
    value: isOpen, 
    toggle: toggleModal, 
    setFalse: closeModal 
  } = useToggle(false);
  
  const { 
    value: isLoading, 
    setTrue: startLoading, 
    setFalse: stopLoading 
  } = useToggle(false);

  const handleSubmit = async () => {
    startLoading();
    
    try {
      await submitData();
      closeModal();
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <button onClick={toggleModal}>打开弹窗</button>
      
      {isOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>确认操作</h2>
            <p>确定要执行此操作吗？</p>
            
            <button 
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? '处理中...' : '确定'}
            </button>
            <button onClick={closeModal}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Hooks 常见陷阱

### 闭包陷阱

```jsx
// ❌ 闭包陷阱示例
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // 这里捕获的是初始的 count 值（0）
      console.log('当前 count:', count);
      setCount(count + 1); // 永远设置为 1
    }, 1000);
    
    return () => clearInterval(interval);
  }, []); // 依赖数组为空，effect 只执行一次
  
  return <div>{count}</div>;
}

// ✅ 修复方案1：使用函数式更新
function CounterFixed1() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // 使用函数式更新，不需要依赖外部状态
      setCount(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return <div>{count}</div>;
}

// ✅ 修复方案2：使用 ref
function CounterFixed2() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  
  // 同步 ref 和 state
  useEffect(() => {
    countRef.current = count;
  }, [count]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('当前 count:', countRef.current);
      setCount(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return <div>{count}</div>;
}

// ✅ 修复方案3：添加正确的依赖
function CounterFixed3() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('当前 count:', count);
      setCount(count + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [count]); // 添加 count 到依赖数组
  
  return <div>{count}</div>;
}
```

### 依赖数组问题

```jsx
// ❌ 错误：遗漏依赖
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // 遗漏了 userId
  
  return <div>{user?.name}</div>;
}

// ✅ 正确：包含所有依赖
function UserProfileFixed({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]); // 包含 userId
  
  return <div>{user?.name}</div>;
}

// ❌ 错误：依赖不稳定
function SearchResults({ searchTerm }) {
  const [results, setResults] = useState([]);
  
  // 每次渲染都会创建新的函数对象
  const fetchResults = async () => {
    const response = await fetch(`/api/search?q=${searchTerm}`);
    const data = await response.json();
    setResults(data);
  };
  
  useEffect(() => {
    fetchResults();
  }, [fetchResults]); // fetchResults 每次渲染都不同
  
  return <div>{results.length} 个结果</div>;
}

// ✅ 正确：使用 useCallback 或内联
function SearchResultsFixed({ searchTerm }) {
  const [results, setResults] = useState([]);
  
  // 方案1：使用 useCallback
  const fetchResults = useCallback(async () => {
    const response = await fetch(`/api/search?q=${searchTerm}`);
    const data = await response.json();
    setResults(data);
  }, [searchTerm]);
  
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);
  
  // 方案2：直接内联
  useEffect(() => {
    const fetchResults = async () => {
      const response = await fetch(`/api/search?q=${searchTerm}`);
      const data = await response.json();
      setResults(data);
    };
    
    fetchResults();
  }, [searchTerm]);
  
  return <div>{results.length} 个结果</div>;
}
```

### 避免过度优化

```jsx
// ❌ 不必要的 useMemo
function ExpensiveComponent({ items }) {
  // 即使 items 没变，每次渲染都会重新计算
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);
  
  return (
    <ul>
      {sortedItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}

// ✅ 正确使用 useMemo
function ExpensiveComponentFixed({ items }) {
  const sortedItems = useMemo(() => {
    // 只有当 items 引用变化时才重新计算
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);
  
  return (
    <ul>
      {sortedItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}

// ❌ 不必要的 useCallback
function Button({ onClick, children }) {
  // onClick 引用可能不稳定，但按钮点击不会频繁触发
  const handleClick = useCallback(() => {
    console.log('按钮被点击');
    onClick();
  }, [onClick]);
  
  return <button onClick={handleClick}>{children}</button>;
}

// ✅ 直接使用，除非有特定需求
function ButtonFixed({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>;
}
```

## 要点总结

1. **Hook 规则**：只在顶层调用，只在 React 函数中调用
2. **链表结构**：理解 React 内部如何存储 Hook 状态
3. **useLayoutEffect**：用于需要同步更新 DOM 的场景
4. **useImperativeHandle**：安全地暴露组件实例方法
5. **useId**：生成服务端渲染安全的唯一 ID
6. **自定义 Hook**：遵循单一职责，以 `use` 开头
7. **闭包陷阱**：理解闭包如何捕获状态，使用函数式更新或 ref 解决
8. **依赖数组**：确保包含所有依赖，避免过度优化
