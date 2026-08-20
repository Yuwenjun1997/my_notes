---
url: >-
  /my_notes/notes/前端学习路线/di-liu-jie-duan-react-kai-fa-jin-jie/6-react-biao-dan-chu-li-react-hook-form-yu-zod-xiao-yan/index.md
---
# React 表单处理：React Hook Form 与 Zod 校验

React Hook Form（RHF）通过非受控组件策略大幅提升表单性能，Zod 提供类型安全的 Schema 校验——二者结合已成为 React 表单处理的事实标准。

## 表单痛点

| 痛点 | 传统受控组件 | RHF 的解决 |
|:-----|:-----------|:----------|
| 渲染性能 | 每次输入触发全组件重渲染 | 非受控组件，通过 ref 读写，跳过 re-render |
| Boilerplate | 每个字段需 useState + onChange | `register` 一行搞定 |
| 校验逻辑 | 手动 if/else，难以复用 | 集成 Zod 声明式校验 |
| 错误处理 | 手动维护 errors 对象 | `formState.errors` 自动管理 |

## RHF 核心概念

```jsx
import { useForm } from 'react-hook-form';

function LoginForm() {
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  return (
    <form onSubmit={handleSubmit(data => console.log(data))}>
      <input {...register('email', { required: '邮箱不能为空' })} />
      {errors.email && <span>{errors.email.message}</span>}
      <input type="password" {...register('password', { required: true, minLength: 6 })} />
      {errors.password && <span>{errors.password.message}</span>}
      <button disabled={isSubmitting}>登录</button>
    </form>
  );
}
```

`register` 返回 `{ name, ref, onChange, onBlur }`，通过 ref 而非 value/onChange 读写字段——这是性能优势的来源。`formState` 常用属性：`errors`（校验错误）、`isSubmitting`（提交中）、`isDirty`（是否修改过）。

## Zod Schema 校验

```ts
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2, '姓名至少2个字符'),
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少8位')
    .regex(/[A-Z]/, '需包含大写字母').regex(/[0-9]/, '需包含数字'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: '两次密码不一致', path: ['confirmPassword'],
});

type UserFormData = z.infer<typeof userSchema>;  // 自动推断类型
```

## RHF + Zod 集成

```jsx
import { zodResolver } from '@hookform/resolvers/zod';

function SignupPage() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(userSchema),
  });
  return (
    <form onSubmit={handleSubmit(data => console.log(data))}>
      <input {...register('name')} />{errors.name && <p>{errors.name.message}</p>}
      <input {...register('email')} />{errors.email && <p>{errors.email.message}</p>}
      <input type="password" {...register('password')} />
      <input type="password" {...register('confirmPassword')} />
      {errors.confirmPassword && <p>{errors.confirmPassword.message}</p>}
      <button type="submit">注册</button>
    </form>
  );
}
```

## 高级用法

### FormProvider 跨组件共享

```jsx
import { useForm, FormProvider, useFormContext } from 'react-hook-form';

function EmailField() {
  const { register, formState: { errors } } = useFormContext();
  return <div><input {...register('email')} />{errors.email && <span>{errors.email.message}</span>}</div>;
}

function AuthForm() {
  const methods = useForm({ resolver: zodResolver(userSchema) });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <EmailField /><PasswordField /><button>提交</button>
      </form>
    </FormProvider>
  );
}
```

### Controller 集成第三方组件

```jsx
import { Controller } from 'react-hook-form';
import { Select } from 'antd';

function ControlledSelect({ name, control, options }) {
  return (
    <Controller name={name} control={control}
      render={({ field, fieldState: { error } }) => (
        <div><Select {...field} options={options} />{error && <span>{error.message}</span>}</div>
      )} />
  );
}
```

### 动态字段 useFieldArray

```jsx
import { useFieldArray } from 'react-hook-form';

function SkillsForm() {
  const { control, register } = useForm({ defaultValues: { skills: [{ name: '', level: 'beginner' }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'skills' });
  return (
    <div>
      {fields.map((f, i) => (
        <div key={f.id}>
          <input {...register(`skills.${i}.name`)} />
          <button onClick={() => remove(i)}>删除</button>
        </div>
      ))}
      <button onClick={() => append({ name: '', level: 'beginner' })}>添加</button>
    </div>
  );
}
```

## 要点总结

* RHF 通过 ref 读写字段，避免不必要的重渲染
* Zod Schema 同时定义校验规则和 TypeScript 类型，`z.infer` 自动推断
* `zodResolver` 一行配置让 RHF 使用 Zod 校验
* `FormProvider` + `useFormContext` 解决跨组件表单状态共享
* `Controller` 桥接 Ant Design、MUI 等第三方 UI 组件
* `useFieldArray` 处理动态增删字段组
