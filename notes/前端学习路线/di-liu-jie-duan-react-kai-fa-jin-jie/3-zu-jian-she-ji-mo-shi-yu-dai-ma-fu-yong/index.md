---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/3-zu-jian-she-ji-mo-shi-yu-dai-ma-fu-yong/index.md
---
# 组件设计模式与代码复用

> 深入探讨 React 中的设计模式与代码复用策略，对比 HOC、Render Props、Custom Hook 等方案的优缺点，并通过实战案例演示 Compound Components 的高级应用。本文旨在帮助开发者选择最适合场景的复用方案。

## 设计模式在 React 中的应用

### 策略模式

将算法封装成独立的策略，使它们可以互相替换。在 React 中常用于处理不同的验证规则、排序方式等。

```jsx
// 验证策略
const validationStrategies = {
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? '' : '邮箱格式不正确';
  },
  
  phone: (value) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(value) ? '' : '手机号格式不正确';
  },
  
  password: (value) => {
    if (value.length < 8) return '密码至少8位';
    if (!/[A-Z]/.test(value)) return '密码需包含大写字母';
    if (!/[a-z]/.test(value)) return '密码需包含小写字母';
    if (!/[0-9]/.test(value)) return '密码需包含数字';
    return '';
  },
  
  required: (value) => {
    return value.trim() ? '' : '此字段为必填项';
  }
};

// 验证 Hook
function useValidation(value, rules) {
  const [error, setError] = useState('');
  
  useEffect(() => {
    let errorMessage = '';
    
    for (const rule of rules) {
      const validator = validationStrategies[rule];
      if (validator) {
        errorMessage = validator(value);
        if (errorMessage) break;
      }
    }
    
    setError(errorMessage);
  }, [value, rules]);
  
  return error;
}

// 表单字段组件
function FormField({ label, value, onChange, rules = [] }) {
  const error = useValidation(value, rules);
  
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'error' : ''}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}

// 使用示例
function RegistrationForm() {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: ''
  });
  
  const handleChange = (field) => (value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  return (
    <form>
      <FormField
        label="邮箱"
        value={formData.email}
        onChange={handleChange('email')}
        rules={['required', 'email']}
      />
      
      <FormField
        label="手机号"
        value={formData.phone}
        onChange={handleChange('phone')}
        rules={['required', 'phone']}
      />
      
      <FormField
        label="密码"
        value={formData.password}
        onChange={handleChange('password')}
        rules={['required', 'password']}
      />
    </form>
  );
}
```

### 观察者模式

通过事件总线或发布-订阅模式实现组件间的松耦合通信。

```jsx
// 事件总线实现
class EventBus {
  constructor() {
    this.listeners = {};
  }
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // 返回取消订阅函数
    return () => {
      this.off(event, callback);
    };
  }
  
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    this.listeners[event] = this.listeners[event].filter(
      cb => cb !== callback
    );
  }
  
  emit(event, ...args) {
    if (!this.listeners[event]) return;
    
    this.listeners[event].forEach(callback => {
      callback(...args);
    });
  }
  
  once(event, callback) {
    const unsubscribe = this.on(event, (...args) => {
      unsubscribe();
      callback(...args);
    });
  }
}

// 创建全局事件总线
const eventBus = new EventBus();

// React Hook 封装
function useEventBus() {
  const subscribe = useCallback((event, callback) => {
    return eventBus.on(event, callback);
  }, []);
  
  const emit = useCallback((event, ...args) => {
    eventBus.emit(event, ...args);
  }, []);
  
  return { subscribe, emit };
}

// 主题切换组件
function ThemeToggle() {
  const { emit } = useEventBus();
  
  const toggleTheme = () => {
    emit('theme-change', { theme: 'dark' });
  };
  
  return (
    <button onClick={toggleTheme}>切换主题</button>
  );
}

// 导航栏组件（监听主题变化）
function Navbar() {
  const [theme, setTheme] = useState('light');
  const { subscribe } = useEventBus();
  
  useEffect(() => {
    const unsubscribe = subscribe('theme-change', ({ theme: newTheme }) => {
      setTheme(newTheme);
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  return (
    <nav className={`navbar ${theme}`}>
      <span>Logo</span>
      <ul>
        <li>首页</li>
        <li>关于</li>
        <li>联系</li>
      </ul>
    </nav>
  );
}
```

### 组合模式

将对象组合成树形结构，使得客户端可以统一处理单个对象和组合对象。

```jsx
// 菜单组件树
function MenuItem({ children, icon, onClick }) {
  return (
    <li className="menu-item" onClick={onClick}>
      {icon && <span className="menu-icon">{icon}</span>}
      {children}
    </li>
  );
}

function MenuGroup({ title, children, icon }) {
  const [isOpen, setIsOpen] = useState(true);
  
  return (
    <li className="menu-group">
      <div 
        className="menu-group-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon && <span className="menu-icon">{icon}</span>}
        <span>{title}</span>
        <span className={`arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>
      
      {isOpen && (
        <ul className="menu-children">
          {children}
        </ul>
      )}
    </li>
  );
}

function Menu({ children, theme = 'light' }) {
  return (
    <nav className={`menu menu-${theme}`}>
      <ul>{children}</ul>
    </nav>
  );
}

// 使用组合模式构建复杂菜单
function Sidebar() {
  return (
    <Menu theme="dark">
      <MenuGroup title="仪表板" icon="📊">
        <MenuItem onClick={() => console.log('概览')}>概览</MenuItem>
        <MenuItem onClick={() => console.log('分析')}>分析</MenuItem>
        <MenuItem onClick={() => console.log('报表')}>报表</MenuItem>
      </MenuGroup>
      
      <MenuGroup title="用户管理" icon="👥">
        <MenuItem onClick={() => console.log('用户列表')}>用户列表</MenuItem>
        <MenuItem onClick={() => console.log('角色管理')}>角色管理</MenuItem>
        <MenuItem onClick={() => console.log('权限设置')}>权限设置</MenuItem>
      </MenuGroup>
      
      <MenuGroup title="系统设置" icon="⚙️">
        <MenuItem onClick={() => console.log('基础设置')}>基础设置</MenuItem>
        <MenuGroup title="高级设置" icon="🔧">
          <MenuItem onClick={() => console.log('邮件配置')}>邮件配置</MenuItem>
          <MenuItem onClick={() => console.log('存储配置')}>存储配置</MenuItem>
        </MenuGroup>
      </MenuGroup>
    </Menu>
  );
}
```

## 代码复用方案对比

| 特性 | HOC | Render Props | Custom Hook |
|------|-----|--------------|-------------|
| 复用逻辑 | 增强组件功能 | 暴露状态和方法 | 封装状态逻辑 |
| 组件嵌套 | 包装组件 | 函数作为子组件 | 直接调用 |
| Props 传递 | 自动注入 | 手动传递 | 手动传递 |
| 类型推导 | 较差 | 较好 | 最佳 |
| 可读性 | 较差 | 中等 | 最佳 |
| 调试难度 | 较难 | 中等 | 较易 |
| 命名冲突 | 可能发生 | 不会发生 | 不会发生 |
| 适用场景 | 增强已有组件 | 需要访问组件状态 | 封装通用逻辑 |

### HOC 实战：增强组件功能

```jsx
// HOC：添加防抖功能
function withDebounce(WrappedComponent, delay = 300) {
  function WithDebounce(props) {
    const [debouncedProps, setDebouncedProps] = useState(props);
    const timeoutRef = useRef(null);
    
    useEffect(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setDebouncedProps(props);
      }, delay);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [props, delay]);
    
    return <WrappedComponent {...debouncedProps} />;
  }
  
  WithDebounce.displayName = `WithDebounce(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithDebounce;
}

// HOC：添加错误边界
function withErrorBoundary(WrappedComponent, fallbackComponent) {
  class WithErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
      console.error('组件错误:', error, errorInfo);
    }
    
    render() {
      if (this.state.hasError) {
        return fallbackComponent ? (
          React.createElement(fallbackComponent, {
            error: this.state.error
          })
        ) : (
          <div className="error-boundary">
            <h2>出错了</h2>
            <p>{this.state.error?.message}</p>
          </div>
        );
      }
      
      return <WrappedComponent {...this.props} />;
    }
  }
  
  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundary;
}

// 使用示例
function UserProfile({ user, loading }) {
  if (loading) return <div>加载中...</div>;
  
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 包装组件
const UserProfileWithDebounce = withDebounce(UserProfile, 500);
const UserProfileWithErrorBoundary = withErrorBoundary(UserProfileWithDebounce);
```

### Render Props 实战：复用状态逻辑

```jsx
// 数据获取组件
function DataFetcher({ url, render, onError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(url, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted && err.name !== 'AbortError') {
          setError(err);
          onError?.(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    fetchData();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [url, onError]);
  
  return render({ data, loading, error });
}

// 使用示例
function UserList() {
  return (
    <DataFetcher
      url="/api/users"
      onError={(error) => console.error('获取用户失败:', error)}
      render={({ data, loading, error }) => {
        if (loading) {
          return <div className="loading">加载用户列表...</div>;
        }
        
        if (error) {
          return (
            <div className="error">
              <p>错误：{error.message}</p>
              <button onClick={() => window.location.reload()}>
                重试
              </button>
            </div>
          );
        }
        
        if (!data || data.length === 0) {
          return <div className="empty">暂无用户</div>;
        }
        
        return (
          <ul className="user-list">
            {data.map(user => (
              <li key={user.id} className="user-item">
                <h3>{user.name}</h3>
                <p>{user.email}</p>
                <span className="role">{user.role}</span>
              </li>
            ))}
          </ul>
        );
      }}
    />
  );
}
```

### Custom Hook 实战：封装通用逻辑

```jsx
// 通用状态管理 Hook
function useAsync(asyncFn, immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await asyncFn(...args);
      setData(result);
      
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFn]);
  
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);
  
  return {
    data,
    loading,
    error,
    execute,
    setData,
    reset: () => {
      setData(null);
      setError(null);
    }
  };
}

// 使用示例：获取用户列表
function UserList() {
  const fetchUsers = useCallback(async () => {
    const response = await fetch('/api/users');
    if (!response.ok) {
      throw new Error('获取用户失败');
    }
    return response.json();
  }, []);
  
  const { data: users, loading, error, execute: refetch } = useAsync(fetchUsers);
  
  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误：{error.message}</div>;
  
  return (
    <div>
      <button onClick={refetch}>刷新</button>
      <ul>
        {users?.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

// 表单状态管理 Hook
function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = useCallback((field, value) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除字段错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  }, [errors]);
  
  const handleBlur = useCallback((field) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
  }, []);
  
  const handleSubmit = useCallback(async (onSubmit) => {
    // 验证所有字段
    const validationErrors = validate(values);
    setErrors(validationErrors);
    
    // 标记所有字段为已触摸
    const allTouched = {};
    Object.keys(values).forEach(field => {
      allTouched[field] = true;
    });
    setTouched(allTouched);
    
    // 如果有错误，停止提交
    if (Object.keys(validationErrors).length > 0) {
      return false;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      return true;
    } catch (error) {
      console.error('提交失败:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate]);
  
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);
  
  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset
  };
}

// 使用示例
function ContactForm() {
  const validate = (values) => {
    const errors = {};
    
    if (!values.name.trim()) {
      errors.name = '姓名不能为空';
    }
    
    if (!values.email) {
      errors.email = '邮箱不能为空';
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      errors.email = '邮箱格式不正确';
    }
    
    if (!values.message.trim()) {
      errors.message = '消息不能为空';
    }
    
    return errors;
  };
  
  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit
  } = useForm({ name: '', email: '', message: '' }, validate);
  
  const onSubmit = async (formValues) => {
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });
    
    alert('提交成功！');
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(onSubmit);
    }}>
      <div>
        <label>姓名：</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
        />
        {touched.name && errors.name && (
          <span className="error">{errors.name}</span>
        )}
      </div>
      
      <div>
        <label>邮箱：</label>
        <input
          type="email"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
        />
        {touched.email && errors.email && (
          <span className="error">{errors.email}</span>
        )}
      </div>
      
      <div>
        <label>消息：</label>
        <textarea
          value={values.message}
          onChange={(e) => handleChange('message', e.target.value)}
          onBlur={() => handleBlur('message')}
        />
        {touched.message && errors.message && (
          <span className="error">{errors.message}</span>
        )}
      </div>
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '提交'}
      </button>
    </form>
  );
}
```

## Compound Components 深入实战

```jsx
import { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Tabs 复合组件
const TabsContext = createContext();

function Tabs({ 
  defaultValue, 
  value: controlledValue, 
  onChange,
  children,
  className = ''
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  
  // 支持受控和非受控模式
  const activeTab = controlledValue !== undefined ? controlledValue : internalValue;
  
  const handleTabChange = useCallback((newValue) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  }, [controlledValue, onChange]);
  
  const contextValue = useMemo(() => ({
    activeTab,
    onTabChange: handleTabChange
  }), [activeTab, handleTabChange]);
  
  return (
    <TabsContext.Provider value={contextValue}>
      <div className={`tabs ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// Tab 列表容器
function TabList({ children, className = '' }) {
  return (
    <div 
      className={`tab-list ${className}`} 
      role="tablist"
    >
      {children}
    </div>
  );
}

// 单个 Tab
function Tab({ 
  value, 
  disabled = false, 
  children, 
  className = '' 
}) {
  const { activeTab, onTabChange } = useContext(TabsContext);
  const isActive = activeTab === value;
  
  const handleClick = () => {
    if (!disabled) {
      onTabChange(value);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };
  
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      className={`tab ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// Tab 面板容器
function TabPanels({ children, className = '' }) {
  const { activeTab } = useContext(TabsContext);
  
  return (
    <div className={`tab-panels ${className}`}>
      {children}
    </div>
  );
}

// 单个 Tab 面板
function TabPanel({ 
  value, 
  children, 
  className = '' 
}) {
  const { activeTab } = useContext(TabsContext);
  
  if (activeTab !== value) {
    return null;
  }
  
  return (
    <div
      role="tabpanel"
      className={`tab-panel ${className}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

// 导出组件
Tabs.TabList = TabList;
Tabs.Tab = Tab;
Tabs.TabPanels = TabPanels;
Tabs.TabPanel = TabPanel;

// 使用示例
function App() {
  const [activeTab, setActiveTab] = useState('tab1');
  
  return (
    <div>
      {/* 非受控模式 */}
      <Tabs defaultValue="tab1">
        <Tabs.TabList>
          <Tabs.Tab value="tab1">用户信息</Tabs.Tab>
          <Tabs.Tab value="tab2">订单历史</Tabs.Tab>
          <Tabs.Tab value="tab3" disabled>设置</Tabs.Tab>
        </Tabs.TabList>
        
        <Tabs.TabPanels>
          <Tabs.TabPanel value="tab1">
            <h3>用户信息</h3>
            <p>这里是用户信息的内容</p>
          </Tabs.TabPanel>
          
          <Tabs.TabPanel value="tab2">
            <h3>订单历史</h3>
            <p>这里是订单历史的内容</p>
          </Tabs.TabPanel>
          
          <Tabs.TabPanel value="tab3">
            <h3>设置</h3>
            <p>这里是设置的内容</p>
          </Tabs.TabPanel>
        </Tabs.TabPanels>
      </Tabs>
      
      {/* 受控模式 */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.TabList>
          <Tabs.Tab value="tab1">标签 1</Tabs.Tab>
          <Tabs.Tab value="tab2">标签 2</Tabs.Tab>
        </Tabs.TabList>
        
        <Tabs.TabPanels>
          <Tabs.TabPanel value="tab1">内容 1</Tabs.TabPanel>
          <Tabs.TabPanel value="tab2">内容 2</Tabs.TabPanel>
        </Tabs.TabPanels>
      </Tabs>
      
      <p>当前激活的标签：{activeTab}</p>
    </div>
  );
}

export { Tabs };
```

## 实战：设计一个可复用的 Tabs 组件

```jsx
// 完整的 Tabs 组件实现
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

const TabsContext = createContext();
const TabPanelContext = createContext();

// Tabs 容器组件
function Tabs({ 
  defaultValue,
  value: controlledValue,
  onChange,
  orientation = 'horizontal',
  lazy = false,
  destroyInactiveTabPanels = false,
  children,
  className = '',
  ...props
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const tabListRef = useRef(null);
  
  const activeTab = controlledValue !== undefined ? controlledValue : internalValue;
  
  const handleTabChange = useCallback((newValue) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  }, [controlledValue, onChange]);
  
  // 键盘导航
  const handleKeyDown = useCallback((e) => {
    const tabList = tabListRef.current;
    if (!tabList) return;
    
    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]:not([disabled])'));
    const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
    
    let nextIndex;
    
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    
    tabs[nextIndex]?.focus();
  }, []);
  
  const contextValue = useMemo(() => ({
    activeTab,
    onTabChange: handleTabChange,
    orientation,
    tabListRef,
    handleKeyDown
  }), [activeTab, handleTabChange, orientation, handleKeyDown]);
  
  const panelContextValue = useMemo(() => ({
    lazy,
    destroyInactiveTabPanels
  }), [lazy, destroyInactiveTabPanels]);
  
  return (
    <TabsContext.Provider value={contextValue}>
      <TabPanelContext.Provider value={panelContextValue}>
        <div 
          className={`tabs tabs-${orientation} ${className}`}
          {...props}
        >
          {children}
        </div>
      </TabPanelContext.Provider>
    </TabsContext.Provider>
  );
}

// Tab 列表
function TabList({ children, className = '', ...props }) {
  const { orientation, tabListRef, handleKeyDown } = useContext(TabsContext);
  
  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-orientation={orientation}
      className={`tab-list ${className}`}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
}

// 单个 Tab
function Tab({ 
  value, 
  disabled = false,
  icon,
  badge,
  children,
  className = '',
  ...props
}) {
  const { activeTab, onTabChange } = useContext(TabsContext);
  const isActive = activeTab === value;
  const tabRef = useRef(null);
  
  const handleClick = () => {
    if (!disabled) {
      onTabChange(value);
    }
  };
  
  // 确保激活的 tab 可见
  useEffect(() => {
    if (isActive && tabRef.current) {
      tabRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [isActive]);
  
  return (
    <button
      ref={tabRef}
      role="tab"
      id={`tab-${value}`}
      aria-selected={isActive}
      aria-disabled={disabled}
      aria-controls={`tabpanel-${value}`}
      tabIndex={isActive ? 0 : -1}
      className={`tab ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="tab-icon">{icon}</span>}
      <span className="tab-content">{children}</span>
      {badge && <span className="tab-badge">{badge}</span>}
    </button>
  );
}

// Tab 面板容器
function TabPanels({ children, className = '' }) {
  return (
    <div className={`tab-panels ${className}`}>
      {children}
    </div>
  );
}

// 单个 Tab 面板
function TabPanel({ 
  value, 
  lazy = false,
  forceMount = false,
  children,
  className = '',
  ...props
}) {
  const { activeTab } = useContext(TabsContext);
  const { lazy: contextLazy, destroyInactiveTabPanels } = useContext(TabPanelContext);
  const isActive = activeTab === value;
  const isLazy = lazy || contextLazy;
  const shouldDestroy = destroyInactiveTabPanels && !isActive;
  const [hasBeenActive, setHasBeenActive] = useState(isActive);
  
  // 记录是否曾经激活过
  useEffect(() => {
    if (isActive) {
      setHasBeenActive(true);
    }
  }, [isActive]);
  
  // 不渲染未激活且需要销毁的面板
  if (shouldDestroy && !hasBeenActive) {
    return null;
  }
  
  // 惰性渲染：只在首次激活时渲染
  if (isLazy && !hasBeenActive) {
    return null;
  }
  
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!isActive}
      className={`tab-panel ${isActive ? 'active' : ''} ${className}`}
      tabIndex={0}
      {...props}
    >
      {forceMount || isActive ? children : null}
    </div>
  );
}

// Tab 图标组件
function TabIcon({ name, className = '' }) {
  // 这里可以集成图标库
  return (
    <span className={`tab-icon ${className}`}>
      {/* 图标内容 */}
      {name}
    </span>
  );
}

// 导出所有组件
Tabs.TabList = TabList;
Tabs.Tab = Tab;
Tabs.TabPanels = TabPanels;
Tabs.TabPanel = TabPanel;
Tabs.TabIcon = TabIcon;

// 使用示例
function UserDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  
  return (
    <div className="dashboard">
      <Tabs value={activeTab} onChange={setActiveTab} lazy>
        <Tabs.TabList>
          <Tabs.Tab value="overview" icon="📊">
            概览
          </Tabs.Tab>
          <Tabs.Tab value="users" icon="👥" badge={12}>
            用户管理
          </Tabs.Tab>
          <Tabs.Tab value="orders" icon="📦">
            订单管理
          </Tabs.Tab>
          <Tabs.Tab value="settings" icon="⚙️" disabled>
            设置
          </Tabs.Tab>
        </Tabs.TabList>
        
        <Tabs.TabPanels>
          <Tabs.TabPanel value="overview">
            <div className="panel-content">
              <h3>系统概览</h3>
              <p>这里是系统概览的内容，包含各种统计数据和图表。</p>
            </div>
          </Tabs.TabPanel>
          
          <Tabs.TabPanel value="users">
            <div className="panel-content">
              <h3>用户管理</h3>
              <p>这里是用户管理的内容，可以查看和管理所有用户。</p>
            </div>
          </Tabs.TabPanel>
          
          <Tabs.TabPanel value="orders">
            <div className="panel-content">
              <h3>订单管理</h3>
              <p>这里是订单管理的内容，可以查看和处理所有订单。</p>
            </div>
          </Tabs.TabPanel>
          
          <Tabs.TabPanel value="settings">
            <div className="panel-content">
              <h3>系统设置</h3>
              <p>这里是系统设置的内容，可以配置各种系统参数。</p>
            </div>
          </Tabs.TabPanel>
        </Tabs.TabPanels>
      </Tabs>
      
      <div className="tab-info">
        <p>当前激活的标签页：{activeTab}</p>
      </div>
    </div>
  );
}

export { Tabs, UserDashboard };
```

## 要点总结

1. **设计模式应用**：策略模式用于可替换算法，观察者模式用于松耦合通信
2. **代码复用方案**：根据场景选择 HOC、Render Props 或 Custom Hook
3. **HOC**：增强组件功能，但要注意命名冲突和可读性
4. **Render Props**：适合需要访问组件状态的场景，避免嵌套地狱
5. **Custom Hook**：最佳方案，类型安全、可读性好、无命名冲突
6. **Compound Components**：构建内聚的 API，通过 Context 共享状态
7. **实战建议**：优先使用 Custom Hook，复杂组件考虑 Compound Components
