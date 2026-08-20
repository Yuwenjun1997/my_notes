---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/15-react-xiang-mu-shi-zhan-yu-zui-jia-shi-jian/index.md
---
# React 项目实战与最佳实践

从零搭建一个 React 项目并不难，但要构建一个可维护、可扩展、高性能的项目，需要遵循一系列最佳实践。本篇将从项目结构设计、代码规范、状态管理、性能优化到 CI/CD，全面介绍 React 项目开发的最佳实践。

## 项目结构设计

### 按功能模块（推荐）

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   ├── utils/
│   │   │   └── auth.utils.ts
│   │   └── index.ts
│   ├── dashboard/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   └── settings/
│       ├── components/
│       └── index.ts
├── shared/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   └── index.ts
│   ├── types/
│   │   └── common.types.ts
│   └── constants/
│       └── index.ts
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   └── db.ts
└── styles/
    ├── globals.css
    └── variables.css
```

### 按组件类型（传统）

```
src/
├── components/
│   ├── common/
│   │   ├── Button/
│   │   ├── Input/
│   │   └── Modal/
│   ├── layout/
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   └── Footer/
│   └── features/
│       ├── LoginForm/
│       └── TodoList/
├── hooks/
├── services/
├── utils/
├── types/
└── styles/
```

### 结构对比

| 特性 | 按功能模块 | 按组件类型 |
|------|-----------|-----------|
| 可维护性 | 高 | 中 |
| 可扩展性 | 高 | 低 |
| 代码复用 | 中 | 高 |
| 学习曲线 | 中 | 低 |
| 适用场景 | 大型项目 | 小型项目 |

## 代码规范

### ESLint + Prettier 配置

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "plugins": [
    "react",
    "react-hooks",
    "@typescript-eslint"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "env": {
    "browser": true,
    "es2022": true,
    "node": true
  },
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "prettier/prettier": "error"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "jsxBracketSameLine": false,
  "arrowParens": "always"
}
```

### husky + lint-staged

```bash
# 安装依赖
npm install -D husky lint-staged

# 初始化 husky
npx husky init

# 添加 pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

## 状态管理策略选择

### 状态管理方案对比

| 方案 | 复杂度 | 适用场景 | 学习曲线 |
|------|--------|----------|----------|
| useState/useReducer | 低 | 局部状态 | 低 |
| Context API | 中 | 跨组件共享 | 中 |
| Zustand | 中 | 中小型项目 | 低 |
| Jotai | 中 | 原子化状态 | 中 |
| Redux Toolkit | 高 | 大型项目 | 高 |
| TanStack Query | 中 | 服务端状态 | 中 |

### 状态分类

```tsx
// 1. UI 状态 - 使用 useState
function Modal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  // ...
}

// 2. 表单状态 - 使用 useForm (react-hook-form)
function ContactForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactFormData>();

  const onSubmit = (data: ContactFormData) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: true })} />
      {errors.name && <span>必填项</span>}
      <button type="submit">提交</button>
    </form>
  );
}

// 3. 服务端状态 - 使用 TanStack Query
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{user?.name}</div>;
}

// 4. 全局状态 - 使用 Zustand
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const user = await loginApi(credentials);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));

// 使用
function App() {
  const { user, isAuthenticated, login, logout } = useAuthStore();
  // ...
}
```

## 错误处理

### 错误边界

```tsx
// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>出错了</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使用
function App() {
  return (
    <ErrorBoundary
      fallback={<div>应用出错了，请刷新页面</div>}
      onError={(error, errorInfo) => {
        // 上报错误到监控服务
        reportError(error, errorInfo);
      }}
    >
      <MainApp />
    </ErrorBoundary>
  );
}
```

### API 错误处理

```tsx
// lib/api.ts
import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Token 过期，跳转登录
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// 自定义 Hook
function useApi() {
  const [error, setError] = useState<ApiError | null>(null);

  const execute = async <T>(apiCall: () => Promise<T>): Promise<T | null> => {
    try {
      setError(null);
      return await apiCall();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        setError(err.response.data);
      } else {
        setError({ message: '网络错误，请稍后重试' });
      }
      return null;
    }
  };

  return { execute, error };
}

// 使用
function CreateUserForm() {
  const { execute, error } = useApi();

  const handleSubmit = async (data: CreateUserDTO) => {
    const user = await execute(() => createUser(data));
    if (user) {
      // 成功处理
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error.message}</div>}
      {/* 表单字段 */}
    </form>
  );
}
```

## 性能优化检查清单

### 组件层面

```tsx
// 1. 使用 React.memo 避免不必要的重渲染
const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
  onUpdate,
}: {
  data: Data;
  onUpdate: (data: Data) => void;
}) {
  // 昂贵的计算
  const result = useMemo(() => computeExpensiveValue(data), [data]);

  return <div>{result}</div>;
});

// 2. 使用 useMemo 缓存计算结果
function DataList({ items }: { items: Item[] }) {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  return (
    <ul>
      {sortedItems.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}

// 3. 使用 useCallback 稳定回调引用
function Parent() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <Child onClick={handleClick} />
    </div>
  );
}

const Child = memo(function Child({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click me</button>;
});

// 4. 使用懒加载减少初始 bundle 大小
const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard />
    </Suspense>
  );
}
```

### 网络层面

```tsx
// 1. 数据预取
export async function getServerSideProps() {
  const posts = await fetchPosts();
  return { props: { posts } };
}

// 2. 缓存策略
const { data } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000,  // 5 分钟
  cacheTime: 30 * 60 * 1000, // 30 分钟
});

// 3. 乐观更新
function ToggleLike({ postId }: { postId: string }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: toggleLike,
    onMutate: async (newLike) => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });

      const previousPost = queryClient.getQueryData(['post', postId]);

      queryClient.setQueryData(['post', postId], (old: any) => ({
        ...old,
        isLiked: !old.isLiked,
        likeCount: old.likeCount + (old.isLiked ? -1 : 1),
      }));

      return { previousPost };
    },
    onError: (err, newLike, context) => {
      queryClient.setQueryData(['post', postId], context?.previousPost);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  return (
    <button onClick={() => mutation.mutate(postId)}>
      {mutation.isPending ? '处理中...' : '点赞'}
    </button>
  );
}
```

### 构建层面

```tsx
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 代码分割
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },

  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },

  // 压缩
  compress: true,

  // 分析包大小
  bundleAnalyzer: process.env.ANALYZE === 'true',
};

module.exports = nextConfig;
```

## 环境变量管理

```bash
# .env.local - 本地开发（不提交到 git）
NEXT_PUBLIC_API_URL=http://localhost:3001/api
DATABASE_URL=postgresql://localhost:5432/mydb

# .env.development - 开发环境
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# .env.production - 生产环境
NEXT_PUBLIC_API_URL=https://api.example.com
```

```tsx
// 类型安全的环境变量
// types/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
    DATABASE_URL: string;
    REDIS_URL: string;
  }
}

// 使用
const apiUrl = process.env.NEXT_PUBLIC_API_URL;  // 客户端可用
const dbUrl = process.env.DATABASE_URL;  // 仅服务端可用
```

## CI/CD：GitHub Actions 示例

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 实战：从零搭建项目的完整目录结构

```bash
# 创建项目
npx create-next-app@latest my-react-app --typescript --tailwind --app --src-dir

# 目录结构
my-react-app/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
│   ├── favicon.ico
│   └── images/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── users/
│   │   │   │   └── route.ts
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── dashboard/
│   │       ├── components/
│   │       └── index.ts
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── layout/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── types/
│   │   └── constants/
│   ├── lib/
│   │   ├── prisma.ts
│   │   └── auth.ts
│   └── styles/
│       └── globals.css
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.local
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

## 最佳实践总结

1. **采用功能模块结构** - 按业务功能组织代码，提高可维护性
2. **统一代码规范** - ESLint + Prettier + husky 保证代码一致性
3. **合理选择状态管理** - 根据项目规模和需求选择合适方案
4. **完善错误处理** - 错误边界 + API 错误处理 + 用户提示
5. **持续性能优化** - 组件/网络/构建三个层面综合优化
6. **管理环境变量** - 区分环境，类型安全
7. **配置 CI/CD** - 自动化测试、构建、部署
8. **编写测试** - 单元测试 + 集成测试 + E2E 测试
9. **文档化** - README + 代码注释 + 组件文档
10. **监控与日志** - 错误监控、性能监控、用户行为分析

遵循这些最佳实践，将帮助你构建出高质量、可维护的 React 项目，为团队协作和长期维护打下坚实基础。
