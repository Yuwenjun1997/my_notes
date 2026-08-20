---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/1-react-he-xin-gai-nian-yu-zu-jian-mo-shi/index.md
---
# React核心概念与组件模式

> 深入理解 React 组件设计原则，掌握常见的组件模式，提升代码的可维护性和复用性。本文从设计原则出发，对比受控与非受控组件，并介绍容器/展示组件、复合组件、渲染属性、高阶组件等进阶模式。

## 组件设计原则

### 单一职责原则

每个组件应该只负责一个功能。当组件承担过多职责时，会导致代码难以维护和测试。

```jsx
// 违反单一职责
function UserCard({ user }) {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => fetchPosts(user.id)}>加载文章</button>
      <button onClick={() => deleteUser(user.id)}>删除用户</button>
    </div>
  );
}

// 遵循单一职责
function UserInfo({ user }) {
  return (
    <div className="user-info">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

function UserActions({ user, onFetchPosts, onDeleteUser }) {
  return (
    <div className="user-actions">
      <button onClick={() => onFetchPosts(user.id)}>加载文章</button>
      <button onClick={() => onDeleteUser(user.id)}>删除用户</button>
    </div>
  );
}
```

### 组合优于继承

React 推荐使用组合（Composition）而非继承（Inheritance）来复用代码。通过 `children` prop 和组合模式，可以构建灵活的组件层次结构。

```jsx
// 使用组合而非继承
function Layout({ children, sidebar }) {
  return (
    <div className="layout">
      <aside className="sidebar">{sidebar}</aside>
      <main className="content">{children}</main>
    </div>
  );
}

// 使用示例
function App() {
  return (
    <Layout sidebar={<NavigationMenu />}>
      <h1>页面标题</h1>
      <p>页面内容</p>
    </Layout>
  );
}
```

## 受控组件 vs 非受控组件

| 特性 | 受控组件 | 非受控组件 |
|------|----------|------------|
| 数据来源 | React 状态管理 | DOM 元素自身 |
| 状态管理 | 通过 onChange 事件更新 | 通过 ref 获取 DOM 值 |
| 验证 | 可即时验证 | 提交时验证 |
| 动态输入 | 容易实现 | 较难实现 |
| 代码复杂度 | 较高 | 较低 |
| 适用场景 | 表单逻辑复杂、需要即时反馈 | 简单表单、与第三方 DOM 库集成 |

### 受控组件示例

```jsx
function ControlledForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 即时验证
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
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
    
    if (formData.password.length < 6) {
      newErrors.password = '密码至少6位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      // 模拟提交
      await submitForm(formData);
      alert('提交成功！');
    } catch (error) {
      alert('提交失败：' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">用户名：</label>
        <input
          id="username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
        />
        {errors.username && <span className="error">{errors.username}</span>}
      </div>
      
      <div>
        <label htmlFor="email">邮箱：</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      
      <div>
        <label htmlFor="password">密码：</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
        />
        {errors.password && <span className="error">{errors.password}</span>}
      </div>
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '注册'}
      </button>
    </form>
  );
}
```

### 非受控组件示例

```jsx
import { useRef, useState } from 'react';

function UncontrolledForm() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 通过 ref 获取文件
    const selectedFile = fileInputRef.current.files[0];
    
    if (!selectedFile) {
      alert('请选择文件');
      return;
    }
    
    // 验证文件类型
    if (!selectedFile.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    
    // 验证文件大小（5MB）
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('文件大小不能超过5MB');
      return;
    }
    
    console.log('上传文件:', selectedFile);
    // 处理文件上传
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>选择图片：</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          required
        />
      </div>
      
      <button type="submit">上传</button>
    </form>
  );
}
```

## 常见组件模式

### 容器/展示组件模式

将数据获取与业务逻辑（容器组件）和 UI 渲染（展示组件）分离。

```jsx
// 展示组件 - 纯 UI，通过 props 接收数据和回调
function UserList({ users, loading, error, onRefresh }) {
  if (loading) {
    return <div className="loading">加载中...</div>;
  }
  
  if (error) {
    return (
      <div className="error">
        <p>错误：{error.message}</p>
        <button onClick={onRefresh}>重试</button>
      </div>
    );
  }
  
  return (
    <div className="user-list">
      <button onClick={onRefresh}>刷新</button>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 容器组件 - 管理状态和业务逻辑
function UserListContainer() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <UserList
      users={users}
      loading={loading}
      error={error}
      onRefresh={fetchUsers}
    />
  );
}
```

### 复合组件（Compound Components）

通过隐式状态共享和组件组合，构建内聚的 API。

```jsx
// Modal 复合组件实现
function Modal({ children, isOpen, onClose }) {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

Modal.Header = function ModalHeader({ children, onClose }) {
  return (
    <div className="modal-header">
      <h2>{children}</h2>
      <button className="close-button" onClick={onClose}>×</button>
    </div>
  );
};

Modal.Body = function ModalBody({ children }) {
  return <div className="modal-body">{children}</div>;
};

Modal.Footer = function ModalFooter({ children }) {
  return <div className="modal-footer">{children}</div>;
};

// 使用示例
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>打开弹窗</button>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Modal.Header onClose={() => setIsModalOpen(false)}>
          确认删除
        </Modal.Header>
        <Modal.Body>
          <p>确定要删除这条记录吗？此操作不可撤销。</p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setIsModalOpen(false)}>取消</button>
          <button onClick={() => {
            // 执行删除操作
            console.log('删除确认');
            setIsModalOpen(false);
          }}>确定</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
```

### 渲染属性（Render Props）

通过函数作为子组件，将组件状态暴露给外部。

```jsx
// 数据获取组件
function DataFetcher({ url, children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(url, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    return () => controller.abort();
  }, [url]);

  return children({ data, loading, error });
}

// 使用示例
function UserProfiles() {
  return (
    <div>
      <h1>用户列表</h1>
      <DataFetcher url="/api/users">
        {({ data, loading, error }) => {
          if (loading) return <p>加载中...</p>;
          if (error) return <p>错误：{error.message}</p>;
          if (!data) return <p>无数据</p>;
          
          return (
            <ul>
              {data.map(user => (
                <li key={user.id}>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                </li>
              ))}
            </ul>
          );
        }}
      </DataFetcher>
    </div>
  );
}
```

### 高阶组件（HOC）

接受组件作为参数，返回增强后的新组件。

```jsx
// 高阶组件：添加日志功能
function withLogging(WrappedComponent) {
  function WithLogging(props) {
    useEffect(() => {
      console.log(`[${WrappedComponent.name}] 组件已挂载`);
      
      return () => {
        console.log(`[${WrappedComponent.name}] 组件已卸载`);
      };
    }, []);
    
    console.log(`[${WrappedComponent.name}] 渲染，props:`, props);
    
    return <WrappedComponent {...props} />;
  }
  
  WithLogging.displayName = `WithLogging(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithLogging;
}

// 高阶组件：添加权限控制
function withAuth(WrappedComponent, requiredRole) {
  function WithAuth(props) {
    const { user, isLoading } = useAuth();
    
    if (isLoading) {
      return <div>验证身份中...</div>;
    }
    
    if (!user) {
      return <div>请先登录</div>;
    }
    
    if (requiredRole && user.role !== requiredRole) {
      return <div>权限不足</div>;
    }
    
    return <WrappedComponent user={user} {...props} />;
  }
  
  WithAuth.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithAuth;
}

// 使用示例
function Dashboard({ user }) {
  return (
    <div>
      <h1>欢迎，{user.name}！</h1>
      <p>这是您的仪表板</p>
    </div>
  );
}

// 包装组件
const DashboardWithLogging = withLogging(Dashboard);
const DashboardWithAuth = withAuth(DashboardWithLogging, 'admin');
```

## 实战：设计一个通用的 Modal 复合组件

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Modal 上下文
const ModalContext = createContext();

// Modal Provider
function ModalProvider({ children }) {
  const [modals, setModals] = useState({});
  
  const openModal = useCallback((modalId, props = {}) => {
    setModals(prev => ({
      ...prev,
      [modalId]: { isOpen: true, ...props }
    }));
  }, []);
  
  const closeModal = useCallback((modalId) => {
    setModals(prev => ({
      ...prev,
      [modalId]: { ...prev[modalId], isOpen: false }
    }));
  }, []);
  
  const toggleModal = useCallback((modalId, props = {}) => {
    setModals(prev => ({
      ...prev,
      [modalId]: { 
        isOpen: !prev[modalId]?.isOpen, 
        ...props 
      }
    }));
  }, []);
  
  return (
    <ModalContext.Provider value={{ modals, openModal, closeModal, toggleModal }}>
      {children}
    </ModalContext.Provider>
  );
}

// 自定义 Hook
function useModal(modalId) {
  const context = useContext(ModalContext);
  
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  
  const { modals, openModal, closeModal } = context;
  const modal = modals[modalId] || { isOpen: false };
  
  return {
    isOpen: modal.isOpen,
    open: (props) => openModal(modalId, props),
    close: () => closeModal(modalId),
    data: modal
  };
}

// Modal 组件
function Modal({ id, children, size = 'medium', closeOnOverlay = true }) {
  const { isOpen, close } = useModal(id);
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);
  
  if (!isOpen) return null;
  
  const sizeClasses = {
    small: 'modal-small',
    medium: 'modal-medium',
    large: 'modal-large'
  };
  
  return (
    <div className="modal-overlay" onClick={closeOnOverlay ? close : undefined}>
      <div className={`modal-content ${sizeClasses[size]}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

Modal.Header = function ModalHeader({ children, showCloseButton = true }) {
  const { close } = useContext(ModalContext);
  
  return (
    <div className="modal-header">
      <h2>{children}</h2>
      {showCloseButton && (
        <button className="modal-close" onClick={close}>×</button>
      )}
    </div>
  );
};

Modal.Body = function ModalBody({ children }) {
  return <div className="modal-body">{children}</div>;
};

Modal.Footer = function ModalFooter({ children, justify = 'flex-end' }) {
  return (
    <div className="modal-footer" style={{ justifyContent: justify }}>
      {children}
    </div>
  );
};

// 使用示例
function App() {
  return (
    <ModalProvider>
      <div>
        <UserManagement />
      </div>
    </ModalProvider>
  );
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const createUserModal = useModal('create-user');
  const editUserModal = useModal('edit-user');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const handleEditUser = (user) => {
    setSelectedUser(user);
    editUserModal.open();
  };
  
  return (
    <div>
      <button onClick={createUserModal.open}>创建用户</button>
      
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.name}
            <button onClick={() => handleEditUser(user)}>编辑</button>
          </li>
        ))}
      </ul>
      
      {/* 创建用户弹窗 */}
      <Modal id="create-user" size="medium">
        <Modal.Header>创建新用户</Modal.Header>
        <Modal.Body>
          <CreateUserForm onSuccess={() => {
            createUserModal.close();
            // 刷新用户列表
          }} />
        </Modal.Body>
      </Modal>
      
      {/* 编辑用户弹窗 */}
      <Modal id="edit-user" size="large">
        <Modal.Header>编辑用户</Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <EditUserForm 
              user={selectedUser} 
              onSuccess={() => {
                editUserModal.close();
                setSelectedUser(null);
              }} 
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <button onClick={editUserModal.close}>取消</button>
          <button onClick={() => {
            // 保存逻辑
            editUserModal.close();
          }}>保存</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export { ModalProvider, Modal, useModal };
```

## 要点总结

1. **组件设计原则**：遵循单一职责，优先使用组合而非继承
2. **受控 vs 非受控**：根据表单复杂度选择，受控组件更适合复杂交互
3. **复合组件**：通过 `children` 组合构建灵活的 API，保持内聚性
4. **渲染属性**：适合需要复用状态逻辑的场景，但可能导致嵌套地狱
5. **高阶组件**：增强组件功能，但要注意 prop 命名冲突和可读性
6. **实战建议**：优先使用复合组件模式，复杂场景考虑 Context + Custom Hook
