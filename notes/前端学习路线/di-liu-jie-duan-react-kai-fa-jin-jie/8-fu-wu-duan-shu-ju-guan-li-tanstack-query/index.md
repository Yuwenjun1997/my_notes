---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/8-fu-wu-duan-shu-ju-guan-li-tanstack-query/index.md
---
# 服务端数据管理：TanStack Query

TanStack Query（原 React Query）是管理服务端状态的事实标准，将缓存、同步、重新获取等复杂逻辑封装为声明式 API，解决了"服务端状态会过时"的核心问题。

## 客户端状态 vs 服务端状态

| 特征 | 客户端状态 | 服务端状态 |
|:-----|:----------|:----------|
| 来源 | 前端产生（UI toggle、表单） | 后端 API 返回 |
| 过时性 | 同步更新 | 随时间推移可能过时 |
| 典型例子 | 模块开关、主题色 | 用户列表、文章详情 |

## QueryClient 与 useQuery

```tsx
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 } },
});

function App() {
  return <QueryClientProvider client={queryClient}><UserList /></QueryClientProvider>;
}

async function fetchUsers() {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('获取失败');
  return res.json();
}

function UserList() {
  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;
  return <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

## useMutation：增删改

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function CreateUserForm() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (newUser) => fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser),
    }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); mutation.mutate({ name: f.get('name'), email: f.get('email') }); }}>
      <input name="name" /><input name="email" /><button disabled={mutation.isPending}>创建</button>
    </form>
  );
}
```

### 乐观更新

在请求发出前就更新 UI，失败时回滚：

```tsx
const toggleMutation = useMutation({
  mutationFn: async ({ id, completed }) => fetch(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) }),
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], old => old.map(t => t.id === newTodo.id ? { ...t, completed: newTodo.completed } : t));
    return { previous };
  },
  onError: (_, __, ctx) => queryClient.setQueryData(['todos'], ctx.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
});
```

## 缓存策略

| 参数 | 默认值 | 说明 |
|:-----|:-------|:-----|
| `staleTime` | 0 | 多长时间内视为"新鲜" |
| `gcTime` | 5 分钟 | 不被使用后多久从缓存移除 |
| `refetchOnWindowFocus` | true | 窗口聚焦时重新获取 |
| `retry` | 3 | 失败重试次数 |

手动失效：`queryClient.invalidateQueries({ queryKey: ['users'] })`；直接设值：`queryClient.setQueryData(['users', 1], updatedUser)`。

## QueryKey 设计

将所有影响数据的参数纳入 QueryKey，确保缓存键精准：

```tsx
useQuery({ queryKey: ['users'], queryFn: fetchAllUsers });
useQuery({ queryKey: ['users', userId], queryFn: () => fetchUser(userId) });
useQuery({ queryKey: ['users', { status: 'active', page: 1 }], queryFn: () => fetchUsers({ status: 'active', page: 1 }) });
```

## useInfiniteQuery

无限滚动场景：

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function InfiniteUserList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['users', 'infinite'],
    queryFn: ({ pageParam }) => fetch(`/api/users?cursor=${pageParam}`).then(r => r.json()),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  return (
    <div>
      {data?.pages.map((p, i) => <div key={i}>{p.users.map(u => <div key={u.id}>{u.name}</div>)}</div>)}
      <button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
        {isFetchingNextPage ? '加载中...' : hasNextPage ? '加载更多' : '没有更多了'}
      </button>
    </div>
  );
}
```

## 实战：用户列表 CRUD

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const userApi = {
  getAll: () => fetch('/api/users').then(r => r.json()),
  create: (d) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
  delete: (id) => fetch(`/api/users/${id}`, { method: 'DELETE' }),
};

function UserManagement() {
  const queryClient = useQueryClient();
  const [newUser, setNewUser] = useState({ name: '', email: '' });
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: userApi.getAll });
  const createMutation = useMutation({ mutationFn: userApi.create, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setNewUser({ name: '', email: '' }); } });
  const deleteMutation = useMutation({
    mutationFn: userApi.delete,
    onMutate: async (id) => { await queryClient.cancelQueries({ queryKey: ['users'] }); const p = queryClient.getQueryData(['users']); queryClient.setQueryData(['users'], old => old.filter(u => u.id !== id)); return { p }; },
    onError: (_, __, ctx) => queryClient.setQueryData(['users'], ctx.p),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
  if (isLoading) return <div>加载中...</div>;
  return (
    <div>
      <input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="姓名" />
      <input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="邮箱" />
      <button onClick={() => createMutation.mutate(newUser)}>添加</button>
      <ul>{users.map(u => <li key={u.id}>{u.name} - {u.email} <button onClick={() => deleteMutation.mutate(u.id)}>删除</button></li>)}</ul>
    </div>
  );
}
```

## 要点总结

* `staleTime` 控制新鲜期，`gcTime` 控制缓存保留时长
* 乐观更新三步：`onMutate`（更新缓存） -> `onError`（回滚） -> `onSettled`（重新同步）
* QueryKey 应包含所有影响数据的参数
* `useInfiniteQuery` 配合 `getNextPageParam` 实现无限滚动
* `invalidateQueries` 是触发数据刷新的核心方法
