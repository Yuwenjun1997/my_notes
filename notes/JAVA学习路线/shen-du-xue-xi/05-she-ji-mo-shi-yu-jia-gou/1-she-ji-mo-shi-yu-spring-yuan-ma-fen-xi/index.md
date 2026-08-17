---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/05-she-ji-mo-shi-yu-jia-gou/1-she-ji-mo-shi-yu-spring-yuan-ma-fen-xi/index.md
---
# 设计模式与 Spring 源码分析

## 概述

Spring 框架被誉为"Java 设计模式的集大成者"。几乎所有的 GoF 设计模式都能在 Spring 源码中找到身影。理解这些设计模式在 Spring 中的应用，不仅能帮助开发者写出更优雅的代码，更能深入理解 Spring 的设计思想与实现原理。

本文从**创建型、结构型、行为型**三个维度，逐一分析设计模式在 Spring 源码中的具体应用，每个模式都配有源码位置、代码示例和对比分析。

***

## 一、创建型模式在 Spring 中的应用

创建型模式关注对象的创建过程，将对象的创建与使用分离，提高系统的灵活性和可维护性。

### 1.1 单例模式（Singleton Pattern）

#### 模式定义

保证一个类只有一个实例，并提供一个全局访问点。

* **核心角色**：单例类（Singleton）、客户端（Client）
* **关键点**：私有构造器、静态实例、线程安全的获取方法

#### Spring 中的应用

Spring IoC 容器中，Bean 的默认 Scope 就是 `singleton`。Spring 对单例的管理比常规的单例模式更强大：它管理的是"Bean 名称+Bean 定义"维度上的单例，同一个类可以注册多个不同名称的单例 Bean。

**源码位置：**

* `org.springframework.beans.factory.support.DefaultSingletonBeanRegistry`
* `org.springframework.beans.factory.config.ConfigurableBeanFactory#SCOPE_SINGLETON`

**核心实现：**

```java
// DefaultSingletonBeanRegistry.java - 单例注册表核心代码
public class DefaultSingletonBeanRegistry extends SimpleAliasRegistry implements SingletonBeanRegistry {

    /** 一级缓存：单例对象的缓存池（成品） */
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

    /** 三级缓存：存放 ObjectFactory，用于解决循环依赖 */
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);

    /** 二级缓存：早期暴露的单例对象（半成品，尚未完成属性注入） */
    private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);

    /** 正在创建中的 Bean 名称集合 */
    private final Set<String> singletonsCurrentlyInCreation = new HashSet<>(16);

    /** 获取单例 Bean 的核心方法 */
    public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory) {
        Assert.notNull(beanName, "Bean name must not be null");
        synchronized (this.singletonObjects) {
            Object singletonObject = this.singletonObjects.get(beanName);
            if (singletonObject == null) {
                // 标记正在创建
                beforeSingletonCreation(beanName);
                try {
                    // 通过 ObjectFactory 创建 Bean
                    singletonObject = singletonFactory.getObject();
                    // 加入一级缓存
                    addSingleton(beanName, singletonObject);
                } finally {
                    afterSingletonCreation(beanName);
                }
            }
            return singletonObject;
        }
    }
}
```

**三级缓存解决循环依赖：**

```java
// 从一级缓存获取
Object singletonObject = this.singletonObjects.get(beanName);
if (singletonObject == null) {
    // 从二级缓存获取（半成品）
    singletonObject = this.earlySingletonObjects.get(beanName);
    if (singletonObject == null) {
        // 从三级缓存获取 ObjectFactory，生成早期引用
        ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
        if (singletonFactory != null) {
            singletonObject = singletonFactory.getObject();
            this.earlySingletonObjects.put(beanName, singletonObject);
            this.singletonFactories.remove(beanName);
        }
    }
}
```

**Spring 单例的线程安全保证：**

* 使用 `ConcurrentHashMap` 存储单例对象
* 通过 `synchronized` 保证创建过程的并发安全
* 通过三级缓存机制解决循环依赖

#### 优缺点对比

| 维度 | 使用单例模式 | 不用单例模式 |
|------|-------------|-------------|
| 内存占用 | 每个 Bean 只创建一个实例，节省内存 | 每次请求都创建新实例，内存开销大 |
| 性能 | 无重复创建开销，对象复用 | 频繁创建和销毁对象，GC 压力大 |
| 线程安全 | 需考虑有状态 Bean 的并发问题 | 无状态安全，有状态每次是新对象 |
| 适用场景 | 无状态 Service、DAO、工具类 | 有状态的 Bean，如 `@Scope("prototype")` |

***

### 1.2 工厂模式（Factory Pattern）

#### 模式定义

**简单工厂**：由一个工厂类根据参数决定创建哪种产品实例。
**工厂方法**：定义一个创建对象的接口，由子类决定实例化哪个类。
**抽象工厂**：创建相关或依赖对象的家族，而不指定具体类。

#### Spring 中的应用

#### BeanFactory — 简单工厂 + 工厂方法

`BeanFactory` 是 Spring IoC 容器的顶级接口，定义了获取 Bean 的通用方法。它既是一个简单工厂（通过 `getBean(String name)` 获取），也是工厂方法模式的体现（各种 `ApplicationContext` 实现不同的创建策略）。

```java
// BeanFactory.java - 核心接口
public interface BeanFactory {
    // 通过名称获取 Bean
    Object getBean(String name) throws BeansException;

    // 通过类型获取 Bean
    <T> T getBean(Class<T> requiredType) throws BeansException;

    // 通过名称+类型获取 Bean
    <T> T getBean(String name, Class<T> requiredType) throws BeansException;

    // 是否包含 Bean
    boolean containsBean(String name);

    // 判断是否是单例
    boolean isSingleton(String name);

    // 判断是否是原型
    boolean isPrototype(String name);
}
```

**类层次结构（工厂方法模式）：**

```
BeanFactory (顶级接口)
    ↑
ListableBeanFactory (可列举的 BeanFactory)
    ↑
ApplicationContext (应用上下文)
    ↑
AbstractApplicationContext (模板方法)
    ↑
AbstractRefreshableApplicationContext (可刷新的)
    ↑
ClassPathXmlApplicationContext / AnnotationConfigApplicationContext
```

每个子类实现自己的 `refresh()` 方法来创建不同类型的容器，这就是工厂方法模式。

#### FactoryBean — 工厂 Bean 模式

`FactoryBean` 是一个特殊的 Bean，它本身不返回自己的实例，而是返回 `getObject()` 方法的返回值。常用于创建复杂的代理对象。

```java
// FactoryBean.java
public interface FactoryBean<T> {
    // 返回工厂创建的 Bean 实例
    T getObject() throws Exception;

    // 返回 Bean 的类型
    Class<?> getObjectType();

    // 是否单例
    default boolean isSingleton() {
        return true;
    }
}

// 典型用途：MyBatis MapperFactoryBean
// 创建 Mapper 接口的代理对象
public class MapperFactoryBean<T> extends SqlSessionDaoSupport implements FactoryBean<T> {
    private Class<T> mapperInterface;

    @Override
    public T getObject() throws Exception {
        // 通过 SqlSession 创建 Mapper 代理
        return getSqlSession().getMapper(this.mapperInterface);
    }

    @Override
    public Class<?> getObjectType() {
        return this.mapperInterface;
    }
}
```

**BeanFactory vs FactoryBean 区别：**

| 特性 | BeanFactory | FactoryBean |
|------|-------------|-------------|
| 角色 | IoC 容器，管理所有 Bean | 特殊的 Bean，用于创建复杂对象 |
| 本质 | 容器接口 | Bean 接口 |
| 获取方式 | `getBean("userService")` | `getBean("&sqlSessionFactory")` 带 `&` 前缀获取 FactoryBean 本身 |
| 典型实现 | ClassPathXmlApplicationContext | MapperFactoryBean、ProxyFactoryBean |
| 主要用途 | 统一管理 Bean 生命周期 | 简化复杂对象的创建过程（如代理对象） |

#### 优缺点对比

| 维度 | 使用工厂模式 | 不用工厂模式 |
|------|-------------|-------------|
| 解耦性 | 客户端只依赖接口，不依赖具体实现 | 客户端需 `new` 具体类，强耦合 |
| 扩展性 | 新增实现类无需修改客户端代码 | 新增实现类需修改所有客户端 |
| 复杂度 | 增加工厂类和接口层次 | 结构简单，但耦合高 |
| 维护性 | 集中管理对象创建，维护方便 | 对象创建分散在各处，改动成本高 |

***

### 1.3 建造者模式（Builder Pattern）

#### 模式定义

将一个复杂对象的构建过程与它的表示分离，使得同样的构建过程可以创建不同的表示。

* **核心角色**：Product（产品）、Builder（抽象建造者）、ConcreteBuilder（具体建造者）、Director（指挥者）

#### Spring 中的应用

#### BeanDefinitionBuilder

Spring 中通过 `BeanDefinitionBuilder` 以链式调用的方式构建 `BeanDefinition`：

```java
// 使用 BeanDefinitionBuilder 构建
BeanDefinitionBuilder builder = BeanDefinitionBuilder.genericBeanDefinition(UserService.class);
builder.addPropertyValue("maxRetryCount", 3);
builder.setScope(ConfigurableBeanFactory.SCOPE_SINGLETON);
builder.setLazyInit(true);
BeanDefinition bd = builder.getBeanDefinition();

// 注册到容器
DefaultListableBeanFactory factory = new DefaultListableBeanFactory();
factory.registerBeanDefinition("userService", bd);
```

**源码实现：**

```java
// BeanDefinitionBuilder.java
public class BeanDefinitionBuilder {

    private final AbstractBeanDefinition beanDefinition;

    public BeanDefinitionBuilder addPropertyValue(String name, Object value) {
        this.beanDefinition.getPropertyValues().add(name, value);
        return this;  // 返回自身，支持链式调用
    }

    public BeanDefinitionBuilder setScope(String scope) {
        this.beanDefinition.setScope(scope);
        return this;
    }

    public BeanDefinitionBuilder setLazyInit(boolean lazyInit) {
        this.beanDefinition.setLazyInit(lazyInit);
        return this;
    }

    public AbstractBeanDefinition getBeanDefinition() {
        return this.beanDefinition;
    }
}
```

#### MockMvcWebClientBuilder（Spring MVC Test）

```java
// 建造者模式创建 MockMvc
MockMvc mockMvc = MockMvcBuilders
    .webAppContextSetup(webApplicationContext)
    .apply(springSecurity())
    .addFilters(new CharacterEncodingFilter("UTF-8"))
    .alwaysDo(print())
    .alwaysExpect(status().isOk())
    .build();
```

#### 优缺点对比

| 维度 | 使用建造者模式 | 不用建造者模式 |
|------|---------------|---------------|
| 可读性 | 链式调用清晰表达参数含义 | 大量重载构造器，难以区分参数 |
| 灵活性 | 可选参数灵活组合，按需设置 | 要么使用 telescoping constructor（参数爆炸），要么用 setter |
| 不可变性 | 建造完成后对象不可变 | 使用 setter 会导致对象可变 |
| 适用场景 | 对象参数多（>4个）、有必选和可选参数 | 参数少、固定场景 |

***

### 1.4 原型模式（Prototype Pattern）

#### 模式定义

用原型实例指定创建对象的种类，并通过**拷贝**这些原型创建新的对象。

#### Spring 中的应用

```java
@Component
@Scope("prototype")   // 每次获取都创建新实例
public class OrderHandler {
    private List<OrderItem> items = new ArrayList<>();

    public void addItem(OrderItem item) {
        items.add(item);
    }

    public int getItemCount() {
        return items.size();
    }
}

// 使用
OrderHandler handler1 = context.getBean(OrderHandler.class);
handler1.addItem(new OrderItem("item1"));
System.out.println(handler1.getItemCount());  // 1

OrderHandler handler2 = context.getBean(OrderHandler.class);
System.out.println(handler2.getItemCount());  // 0 — 新实例
```

**源码实现（AbstractBeanFactory）：**

```java
protected <T> T doGetBean(String name, ...) {
    // ... 获取 BeanDefinition
    if (mbd.isSingleton()) {
        // 单例：从缓存获取
        sharedInstance = getSingleton(beanName, () -> createBean(beanName, mbd, args));
    } else if (mbd.isPrototype()) {
        // 原型：每次都创建新实例
        Object prototypeInstance = createBean(beanName, mbd, args);
    }
    // ...
}
```

#### 优缺点对比

| 维度 | 使用原型模式 | 不用原型模式 |
|------|-------------|-------------|
| 对象状态隔离 | 每个实例独立，无共享状态问题 | 单例 Bean 在多线程下有状态安全风险 |
| 创建开销 | 原型 Bean 每次都需要完整创建 | 单例一次创建，后续复用 |
| 适用场景 | 有状态的临时对象、线程不安全的 Bean | 无状态的服务类 |

***

## 二、结构型模式在 Spring 中的应用

结构型模式关注如何组合类和对象以形成更大的结构。

### 2.1 代理模式（Proxy Pattern）

#### 模式定义

为另一个对象提供一个替身或占位符以控制对这个对象的访问。

* **核心角色**：Subject（主题接口）、RealSubject（真实主题）、Proxy（代理）

#### Spring 中的应用：AOP 实现

Spring AOP 基于代理模式实现，支持两种代理方式：

#### JDK 动态代理（目标类实现接口时使用）

**源码位置：** `org.springframework.aop.framework.JdkDynamicAopProxy`

```java
// JdkDynamicAopProxy.java（简化核心逻辑）
final class JdkDynamicAopProxy implements AopProxy, InvocationHandler {

    private final AdvisedSupport advised;

    @Override
    public Object getProxy(ClassLoader classLoader) {
        // 为目标接口创建代理对象
        return Proxy.newProxyInstance(classLoader,
                this.advised.getTargetClass().getInterfaces(),
                this);
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 获取拦截器链（增强方法列表）
        List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);

        if (chain.isEmpty()) {
            // 无增强，直接调用目标方法
            return method.invoke(target, args);
        } else {
            // 创建方法调用链，依次执行增强
            MethodInvocation invocation = new ReflectiveMethodInvocation(proxy, target, method, args, targetClass, chain);
            return invocation.proceed();
        }
    }
}
```

#### CGLIB 代理（目标类没有实现接口时使用）

**源码位置：** `org.springframework.aop.framework.CglibAopProxy`

```java
// CglibAopProxy.java（简化核心逻辑）
class CglibAopProxy implements AopProxy {

    @Override
    public Object getProxy(ClassLoader classLoader) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(this.advised.getTargetClass());
        enhancer.setInterfaces(this.advised.getProxiedInterfaces());
        enhancer.setCallback(new DynamicAdvisedInterceptor(this.advised));
        return enhancer.create();
    }

    // CGLIB 回调拦截器
    private static class DynamicAdvisedInterceptor implements MethodInterceptor {
        @Override
        public Object intercept(Object proxy, Method method, Object[] args, MethodProxy methodProxy) throws Throwable {
            // 获取拦截器链
            List<Object> chain = advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);
            // 创建调用链并执行
            CglibMethodInvocation invocation = new CglibMethodInvocation(proxy, target, method, args, targetClass, chain, methodProxy);
            return invocation.proceed();
        }
    }
}
```

**两种代理方式的对比：**

| 特性 | JDK 动态代理 | CGLIB 代理 |
|------|-------------|-----------|
| 原理 | 基于接口，生成代理类实现同一接口 | 基于继承，生成目标类的子类 |
| 要求 | 目标类必须实现至少一个接口 | 目标类不能是 final 类，方法不能是 final |
| 性能（创建时） | 较快，使用 Proxy.newProxyInstance | 较慢，使用 Enhancer 字节码生成 |
| 性能（调用时） | 较慢（JDK 8 前），需反射调用 | 较快，使用 MethodProxy invoke |
| Spring 默认 | 目标类实现接口时默认使用 | 目标类未实现接口时自动回退 |

#### 优缺点对比

| 维度 | 使用代理模式 | 不用代理模式 |
|------|-------------|-------------|
| 关注点分离 | 代理处理横切关注点（事务、日志），业务类只关注业务 | 横切关注点散落在业务代码中 |
| 代码复用 | 一次编写切面逻辑，多处复用 | 每个业务方法都要重复写 |
| 维护性 | 切面集中管理，修改方便 | 修改需改所有业务方法 |
| 性能 | 有代理调用开销（反射/字节码增强） | 直接调用，零开销 |

***

### 2.2 适配器模式（Adapter Pattern）

#### 模式定义

将一个类的接口转换成客户端期望的另一个接口，使原本接口不兼容的类可以一起工作。

* **核心角色**：Target（目标接口）、Adaptee（被适配者）、Adapter（适配器）

#### Spring 中的应用：HandlerAdapter

Spring MVC 中，Controller 有多种实现方式：`@Controller` 注解类、实现 `Controller` 接口、实现 `HttpRequestHandler` 接口等。`HandlerAdapter` 充当适配器，统一调用不同 Controller 类型的处理方法。

**源码位置：** `org.springframework.web.servlet.HandlerAdapter`

```java
// HandlerAdapter.java - 适配器接口
public interface HandlerAdapter {
    // 判断是否支持该处理器
    boolean supports(Object handler);

    // 执行处理器，返回 ModelAndView
    ModelAndView handle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception;
}
```

**具体适配器实现：**

```java
// RequestMappingHandlerAdapter - 适配 @RequestMapping 方法
public class RequestMappingHandlerAdapter extends AbstractHandlerMethodAdapter {
    @Override
    protected ModelAndView handleInternal(HttpServletRequest request,
            HttpServletResponse response, HandlerMethod handlerMethod) throws Exception {
        // 调用 @RequestMapping 标注的方法
        InvocableHandlerMethod invocable = createInvocableHandlerMethod(handlerMethod);
        return invocable.invokeAndHandle(request, response);
    }
}

// SimpleControllerHandlerAdapter - 适配 Controller 接口
public class SimpleControllerHandlerAdapter implements HandlerAdapter {
    @Override
    public boolean supports(Object handler) {
        return (handler instanceof Controller);
    }

    @Override
    public ModelAndView handle(HttpServletRequest request,
            HttpServletResponse response, Object handler) throws Exception {
        // 直接调用 Controller 接口的 handleRequest 方法
        return ((Controller) handler).handleRequest(request, response);
    }
}

// HttpRequestHandlerAdapter - 适配 HttpRequestHandler
public class HttpRequestHandlerAdapter implements HandlerAdapter {
    @Override
    public boolean supports(Object handler) {
        return (handler instanceof HttpRequestHandler);
    }

    @Override
    public ModelAndView handle(HttpServletRequest request,
            HttpServletResponse response, Object handler) throws Exception {
        ((HttpRequestHandler) handler).handleRequest(request, response);
        return null;
    }
}
```

**DispatcherServlet 中的适配器调用：**

```java
// DispatcherServlet.java
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) {
    // 获取处理器（Controller）
    HandlerExecutionChain mappedHandler = getHandler(request);

    // 获取适配器（遍历所有 HandlerAdapter，找到 support 返回 true 的）
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

    // 通过适配器调用处理器
    ModelAndView mv = ha.handle(request, response, mappedHandler.getHandler());
}
```

#### 适配器模式 vs 装饰器模式

| 维度 | 适配器模式 | 装饰器模式 |
|------|-----------|-----------|
| 目的 | 转换接口，解决接口不兼容 | 增强功能，不改变接口 |
| 接口 | 改变原有接口 | 保持原有接口 |
| 关注点 | 对接已存在的代码 | 动态添加职责 |
| 时机 | 设计后期，用于兼容 | 设计时或运行时 |

***

### 2.3 装饰器模式（Decorator Pattern）

#### 模式定义

动态地给一个对象添加额外的职责。比继承更灵活。

* **核心角色**：Component（组件接口）、ConcreteComponent（具体组件）、Decorator（装饰器）、ConcreteDecorator（具体装饰器）

#### Spring 中的应用：BeanWrapper

`BeanWrapper` 为 Java Bean 的属性设置提供了装饰能力，在设置属性值时添加类型转换、嵌套属性、集合属性等额外功能。

**源码位置：** `org.springframework.beans.BeanWrapperImpl`

```java
// BeanWrapper 接口 — 核心组件
public interface BeanWrapper extends ConfigurablePropertyAccessor, TypeConverter, PropertyEditorRegistry {
    Object getWrappedInstance();
    Class<?> getWrappedClass();
    PropertyDescriptor[] getPropertyDescriptors();
    PropertyDescriptor getPropertyDescriptor(String propertyName) throws InvalidPropertyException;

    void setPropertyValue(String propertyName, Object value) throws BeansException;
    Object getPropertyValue(String propertyName) throws BeansException;
}

// BeanWrapperImpl — 具体装饰器
public class BeanWrapperImpl extends AbstractNestablePropertyAccessor implements BeanWrapper {

    private Object object;  // 包装的目标对象

    @Override
    public void setPropertyValue(String propertyName, Object value) throws BeansException {
        // 1. 解析嵌套属性（如 "address.city"）
        AbstractNestablePropertyAccessor nestedPa = getPropertyAccessorForPropertyPath(propertyName);

        // 2. 类型转换（String → 目标类型）
        Object convertedValue = convertForProperty(nestedPa.getPropertyToken(), propertyName, value, targetType);

        // 3. 设置属性值
        nestedPa.setPropertyValue(nestedPa.getPropertyToken(), convertedValue);
    }
}
```

**Spring 中的其他装饰器应用：**

```java
// TransactionProxyFactoryBean — 为 Bean 装饰事务功能
public class TransactionProxyFactoryBean extends AbstractSingletonProxyFactoryBean {
    @Override
    protected Object createMainInterceptor() {
        // 创建事务拦截器，装饰目标 Bean
        TransactionInterceptor interceptor = new TransactionInterceptor();
        interceptor.setTransactionAttributeSource(this.transactionAttributeSource);
        return interceptor;
    }
}
```

**Java IO 也是装饰器模式的经典应用：**

```java
// JDK 中的装饰器模式
InputStream inputStream = new BufferedInputStream(           // 装饰：添加缓冲功能
        new DataInputStream(                                 // 装饰：添加基本类型读取
            new FileInputStream("file.txt")));               // 核心组件
```

#### 优缺点对比

| 维度 | 使用装饰器模式 | 不用装饰器模式 |
|------|--------------|---------------|
| 扩展性 | 通过组合动态扩展，无需修改原有类 | 通过继承扩展，继承层次爆炸 |
| 灵活性 | 运行时动态组合，按需增强 | 编译时确定，静态绑定 |
| 单一职责 | 每个装饰器只负责一个功能 | 一个类承担所有职责 |

***

### 2.4 组合模式（Composite Pattern）

#### 模式定义

将对象组合成树形结构以表示"部分-整体"的层次结构，使客户端对单个对象和组合对象的使用具有一致性。

#### Spring 中的应用

Spring 中多处使用 Composite 类来统一管理一组对象：

```java
// CompositePropertySource — 组合属性源
public class CompositePropertySource extends EnumerablePropertySource<Object> {
    private final Set<PropertySource<?>> propertySources = new LinkedHashSet<>();

    public CompositePropertySource(String name) {
        super(name);
    }

    // 添加子 PropertySource
    public void addPropertySource(PropertySource<?> propertySource) {
        this.propertySources.add(propertySource);
    }

    // 递归查找属性 - 遍历所有子 PropertySource
    @Override
    public Object getProperty(String name) {
        for (PropertySource<?> propertySource : this.propertySources) {
            Object value = propertySource.getProperty(name);
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
```

**Spring Security 中的 Composite：**

```java
// CompositeFilter — 组合多个 Filter
public final class CompositeFilter implements Filter {
    private List<Filter> filters = new ArrayList<>();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        // 依次执行所有子 Filter
        new VirtualFilterChain(chain, filters).doFilter(request, response);
    }
}
```

#### 优缺点对比

| 维度 | 使用组合模式 | 不用组合模式 |
|------|-------------|-------------|
| 客户端一致性 | 叶子和组合对象接口相同，客户端无需区分 | 客户端需根据不同对象类型编写不同处理逻辑 |
| 扩展性 | 新增组件类型很容易 | 组合结构变化时需要修改大量代码 |
| 复杂度 | 设计较复杂，需平衡透明性和安全性 | 实现简单，但扩展困难 |

***

### 2.5 外观模式（Facade Pattern）

#### 模式定义

为子系统中的一组接口提供一个统一的高层接口，使子系统更易使用。

#### Spring 中的应用

#### JdbcTemplate

`JdbcTemplate` 封装了 JDBC 操作的所有底层细节（连接管理、Statement 创建、结果集解析、异常处理），提供简洁的统一入口：

```java
// 外观模式：JdbcTemplate 封装了 JDBC 的复杂操作
// 使用外观（推荐）：
@Autowired
private JdbcTemplate jdbcTemplate;

public List<User> findAllUsers() {
    // 一行代码完成查询，JdbcTemplate 内部处理了连接、Statement、ResultSet、异常
    return jdbcTemplate.query("SELECT * FROM users",
        (rs, rowNum) -> new User(rs.getLong("id"), rs.getString("name")));
}

// 不用外观（直接使用 JDBC）：
public List<User> findAllUsersRaw() {
    Connection conn = null;
    PreparedStatement stmt = null;
    ResultSet rs = null;
    List<User> users = new ArrayList<>();
    try {
        conn = dataSource.getConnection();             // 获取连接
        stmt = conn.prepareStatement("SELECT * FROM users");  // 创建 Statement
        rs = stmt.executeQuery();                      // 执行查询
        while (rs.next()) {
            users.add(new User(rs.getLong("id"), rs.getString("name")));  // 解析结果
        }
    } catch (SQLException e) {
        throw new RuntimeException(e);                 // 异常处理
    } finally {
        if (rs != null) try { rs.close(); } catch (SQLException e) { }
        if (stmt != null) try { stmt.close(); } catch (SQLException e) { }
        if (conn != null) try { conn.close(); } catch (SQLException e) { }
    }
    return users;
}
```

**Spring 中其他外观模式应用：**

* `RestTemplate` — 封装 HTTP 请求的细节
* `RedisTemplate` — 封装 Redis 操作
* `MongoTemplate` — 封装 MongoDB 操作
* `TransactionTemplate` — 封装事务管理

#### 优缺点对比

| 维度 | 使用外观模式 | 不用外观模式 |
|------|-------------|-------------|
| 易用性 | 简洁的 API，一行代码完成复杂操作 | 需了解子系统的每个组件，代码冗长 |
| 耦合度 | 客户端只依赖外观类，与子系统解耦 | 客户端直接依赖子系统所有组件 |
| 学习成本 | 只需学习外观 API | 需了解整个子系统的所有细节 |
| 灵活性 | 被外观限制，无法绕过 | 可以直接操作底层 API，灵活度高 |

***

## 三、行为型模式在 Spring 中的应用

行为型模式关注对象之间的通信和职责分配。

### 3.1 模板方法模式（Template Method Pattern）

#### 模式定义

定义一个操作的算法骨架，将一些步骤延迟到子类中实现。使子类可以在不改变算法结构的情况下重新定义算法的某些步骤。

* **核心角色**：AbstractClass（抽象类）、ConcreteClass（具体子类）

#### Spring 中的应用：JdbcTemplate

`JdbcTemplate` 是模板方法模式的经典应用。它定义了执行 SQL 的固定流程（获取连接、创建 Statement、执行、处理结果、清理资源），而结果集的解析通过回调接口 `RowMapper` 延迟到客户端实现。

**源码位置：** `org.springframework.jdbc.core.JdbcTemplate`

```java
// JdbcTemplate.java — 模板方法模式
public class JdbcTemplate extends JdbcAccessor implements JdbcOperations {

    // 模板方法：查询
    public <T> List<T> query(String sql, RowMapper<T> rowMapper) throws DataAccessException {
        // 固定流程：模板定义了算法骨架
        return query(sql, new RowMapperResultSetExtractor<>(rowMapper));
    }

    public <T> T query(final String sql, final ResultSetExtractor<T> rse) throws DataAccessException {
        // 1. 获取连接（模板固定）
        Connection con = DataSourceUtils.getConnection(obtainDataSource());

        // 2. 创建 Statement（模板固定）
        PreparedStatement ps = con.prepareStatement(sql);

        // 3. 执行查询（模板固定）
        ResultSet rs = ps.executeQuery();

        // 4. ★ 处理结果 — 延迟到子类/回调实现（可变部分）
        //    此处使用回调方式替代继承，是模板方法的变体
        T result = rse.extractData(rs);

        // 5. 清理资源（模板固定）
        JdbcUtils.closeResultSet(rs);
        JdbcUtils.closeStatement(ps);
        DataSourceUtils.releaseConnection(con, getDataSource());

        return result;
    }
}

// RowMapper — 回调接口，客户端实现此接口来定义"可变部分"
public interface RowMapper<T> {
    T mapRow(ResultSet rs, int rowNum) throws SQLException;
}

// 客户端使用：
List<User> users = jdbcTemplate.query("SELECT * FROM users",
    (rs, rowNum) -> new User(
        rs.getLong("id"),
        rs.getString("name")
    )
);
// 用户只需实现 mapRow，其余流程由 JdbcTemplate 统一管理
```

**Spring 中的模板方法应用：**

| 类 | 模板方法 | 回调接口 | 用途 |
|----|---------|---------|------|
| `JdbcTemplate` | `query()` / `update()` | `RowMapper` / `PreparedStatementCallback` | 数据库操作 |
| `RestTemplate` | `execute()` | `ResponseExtractor` | HTTP 请求 |
| `RedisTemplate` | `execute()` | `RedisCallback` | Redis 操作 |
| `TransactionTemplate` | `execute()` | `TransactionCallback` | 事务管理 |
| `AbstractApplicationContext` | `refresh()` | — | 容器刷新流程 |

#### 模板方法的优劣

| 维度 | 使用模板方法 | 不用模板方法 |
|------|-------------|-------------|
| 代码复用 | 重复的流程代码统一在模板中，子类只需实现可变步骤 | 每个实现都要重复编写流程代码 |
| 一致性 | 所有子类遵循相同的算法骨架，不易出错 | 每个实现可能以不同方式处理流程，不一致 |
| 扩展性 | 通过新增子类或回调实现扩展，不修改模板 | 流程变化时需修改所有实现 |
| 控制反转 | 模板控制流程，子类注入具体行为（好莱坞原则） | 调用者控制流程 |

***

### 3.2 观察者模式（Observer Pattern）

#### 模式定义

定义对象之间的一对多依赖关系，当一个对象状态发生变化时，所有依赖它的对象都得到通知并自动更新。

* **核心角色**：Subject（主题）、Observer（观察者）、ConcreteSubject（具体主题）、ConcreteObserver（具体观察者）

#### Spring 中的应用：ApplicationEvent + ApplicationListener

Spring 的事件驱动模型是观察者模式的标准实现。

**源码位置：**

* `org.springframework.context.ApplicationEvent` — 事件（消息）
* `org.springframework.context.ApplicationListener` — 监听器（观察者）
* `org.springframework.context.event.AbstractApplicationEventMulticaster` — 事件广播器（主题）

```java
// 1. 定义事件（消息）
public class OrderCreatedEvent extends ApplicationEvent {
    private final Long orderId;
    private final String orderNo;

    public OrderCreatedEvent(Object source, Long orderId, String orderNo) {
        super(source);
        this.orderId = orderId;
        this.orderNo = orderNo;
    }

    public Long getOrderId() { return orderId; }
    public String getOrderNo() { return orderNo; }
}

// 2. 定义监听器（观察者）— 方式一：实现 ApplicationListener 接口
@Component
public class SmsNotificationListener implements ApplicationListener<OrderCreatedEvent> {
    @Override
    public void onApplicationEvent(OrderCreatedEvent event) {
        System.out.println("发送短信通知：订单 " + event.getOrderNo() + " 已创建");
    }
}

// 2. 定义监听器 — 方式二：使用 @EventListener 注解（更推荐）
@Component
public class EmailNotificationListener {
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        System.out.println("发送邮件通知：订单 " + event.getOrderNo() + " 已创建");
    }
}

@Component
public class InventoryUpdateListener {
    @EventListener
    @Async  // 异步执行
    public void handleOrderCreated(OrderCreatedEvent event) {
        System.out.println("更新库存：订单 " + event.getOrderNo());
    }
}

// 3. 发布事件（主题）
@Service
public class OrderService {
    @Autowired
    private ApplicationEventPublisher eventPublisher;

    public Order createOrder(OrderDTO dto) {
        // 1. 创建订单
        Order order = saveOrder(dto);

        // 2. 发布事件 — 所有监听者自动收到通知
        eventPublisher.publishEvent(new OrderCreatedEvent(this, order.getId(), order.getOrderNo()));

        return order;
    }
}
```

**源码核心实现（事件广播）：**

```java
// SimpleApplicationEventMulticaster.java
public class SimpleApplicationEventMulticaster extends AbstractApplicationEventMulticaster {

    @Override
    public void multicastEvent(ApplicationEvent event, ResolvableType eventType) {
        ResolvableType type = (eventType != null ? eventType : resolveDefaultEventType(event));

        // 获取所有匹配的监听器
        for (ApplicationListener<?> listener : getApplicationListeners(event, type)) {
            // 异步执行（如果有 Executor）
            if (this.taskExecutor != null) {
                this.taskExecutor.execute(() -> invokeListener(listener, event));
            } else {
                // 同步执行（默认）
                invokeListener(listener, event);
            }
        }
    }
}
```

#### 优缺点对比

| 维度 | 使用观察者模式 | 不用观察者模式 |
|------|--------------|---------------|
| 解耦性 | 事件发布者与监听者完全解耦 | 发布者需要直接调用所有依赖方 |
| 扩展性 | 新增监听者无需修改发布者 | 新增依赖需修改发布者代码 |
| 异步支持 | 天然支持异步执行（`@Async` + `@EventListener`） | 需手动编写异步逻辑 |
| 可追踪性 | 事件链路清晰，便于日志追踪 | 调用关系隐式，难以追踪 |
| 调试复杂度 | 事件驱动流程不如直接调用直观 | 调用链明确，易于理解和调试 |

***

### 3.3 策略模式（Strategy Pattern）

#### 模式定义

定义一系列算法，将每个算法封装起来，使它们可以互相替换。算法的变化独立于使用算法的客户端。

* **核心角色**：Strategy（策略接口）、ConcreteStrategy（具体策略）、Context（上下文）

#### Spring 中的应用

#### 资源访问策略：Resource 接口

Spring 的 `Resource` 接口定义了统一的资源访问策略，不同实现代表不同资源来源：

```java
// 策略接口
public interface Resource extends InputStreamSource {
    boolean exists();
    boolean isReadable();
    URL getURL() throws IOException;
    File getFile() throws IOException;
    InputStream getInputStream() throws IOException;
}

// 具体策略1：文件系统资源
Resource fileResource = new FileSystemResource("/var/app/config.properties");

// 具体策略2：类路径资源
Resource classpathResource = new ClassPathResource("application.yml");

// 具体策略3：URL 资源
Resource urlResource = new UrlResource("https://example.com/config.properties");

// 具体策略4：Servlet 上下文资源
Resource servletResource = new ServletContextResource(servletContext, "/WEB-INF/config.xml");

// 上下文 — 统一使用资源
public class ResourceLoaderClient {
    public void loadConfig(Resource resource) throws IOException {
        // 统一使用 Resource 接口，不关心具体是哪种资源
        Properties props = new Properties();
        props.load(resource.getInputStream());
        // ...
    }
}
```

#### 实例化策略：InstantiationStrategy

Spring 创建 Bean 实例时有多种策略：

```java
// 策略接口
public interface InstantiationStrategy {
    Object instantiate(RootBeanDefinition bd, String beanName, BeanFactory owner);

    Object instantiate(RootBeanDefinition bd, String beanName, BeanFactory owner,
            Constructor<?> ctor, Object... args);

    Object instantiate(RootBeanDefinition bd, String beanName, BeanFactory owner,
            Object factoryBean, Method factoryMethod, Object... args);
}

// 具体策略1：CglibSubclassingInstantiationStrategy（默认）
// 使用 CGLIB 动态生成子类，支持方法注入
public class CglibSubclassingInstantiationStrategy extends SimpleInstantiationStrategy {
    @Override
    protected Object instantiateWithMethodInjection(RootBeanDefinition bd, String beanName, BeanFactory owner) {
        // 使用 CGLIB Enhancer 创建代理子类
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(bd.getBeanClass());
        // ... 设置回调
        return enhancer.create();
    }
}

// 具体策略2：SimpleInstantiationStrategy
// 使用反射直接创建实例，不支持方法注入
public class SimpleInstantiationStrategy implements InstantiationStrategy {
    @Override
    public Object instantiate(RootBeanDefinition bd, String beanName, BeanFactory owner) {
        // 使用反射调用构造器
        Constructor<?> constructorToUse = bd.getBeanClass().getDeclaredConstructor();
        return BeanUtils.instantiateClass(constructorToUse);
    }
}
```

#### 优缺点对比

| 维度 | 使用策略模式 | 不用策略模式 |
|------|-------------|-------------|
| 算法切换 | 运行时动态切换策略 | 通过 if-else 硬编码，修改需改代码 |
| 开闭原则 | 新增策略无需修改上下文 | 新增算法需修改原有条件分支 |
| 复用性 | 策略类独立，可复用 | 算法与业务逻辑混杂 |
| 类数量 | 每个策略一个类，类数量增加 | 没有额外类，但方法内聚性差 |

***

### 3.4 责任链模式（Chain of Responsibility Pattern）

#### 模式定义

避免请求发送者与接收者耦合，让多个对象都有机会处理请求，将这些对象连成一条链，并沿着链传递请求直到有一个对象处理它。

* **核心角色**：Handler（处理器接口）、ConcreteHandler（具体处理器）、Client（客户端）

#### Spring 中的应用

#### FilterChain（Servlet 过滤器链）

```java
// Servlet 中的 FilterChain — 责任链
public interface FilterChain {
    void doFilter(ServletRequest request, ServletResponse response);
}

// Spring Security 的过滤器链
public class SecurityFilterChain {
    public boolean matches(HttpServletRequest request);
    public List<Filter> getFilters();
}

// 虚拟过滤器链的执行逻辑
private static class VirtualFilterChain implements FilterChain {
    private final FilterChain originalChain;
    private final List<Filter> additionalFilters;
    private int currentPosition = 0;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response) {
        if (currentPosition == additionalFilters.size()) {
            // 所有过滤器执行完毕，调用原始链
            originalChain.doFilter(request, response);
        } else {
            currentPosition++;
            // 获取下一个过滤器并执行
            Filter nextFilter = additionalFilters.get(currentPosition - 1);
            nextFilter.doFilter(request, response, this);
        }
    }
}
```

#### InterceptorChain（Spring MVC 拦截器链）

```java
// HandlerExecutionChain — Spring MVC 拦截器链
public class HandlerExecutionChain {

    private List<HandlerInterceptor> interceptorList;

    // 前置拦截
    boolean applyPreHandle(HttpServletRequest request, HttpServletResponse response) throws Exception {
        for (int i = 0; i < this.interceptorList.size(); i++) {
            HandlerInterceptor interceptor = this.interceptorList.get(i);
            if (!interceptor.preHandle(request, response, this.handler)) {
                // 返回 false 则中断链
                triggerAfterCompletion(request, response, null);
                return false;
            }
        }
        return true;
    }

    // 后置拦截
    void applyPostHandle(HttpServletRequest request, HttpServletResponse response, ModelAndView mv) {
        for (int i = this.interceptorList.size() - 1; i >= 0; i--) {
            this.interceptorList.get(i).postHandle(request, response, this.handler, mv);
        }
    }
}
```

#### MethodInterceptor（AOP 通知链）

```java
// ReflectiveMethodInvocation — AOP 方法调用链
public class ReflectiveMethodInvocation implements ProxyMethodInvocation {

    private final Object proxy;
    private final Object target;
    private final Method method;
    private final Object[] arguments;
    private final List<?> interceptorsAndDynamicMethodMatchers;
    private int currentInterceptorIndex = -1;

    @Override
    public Object proceed() throws Throwable {
        // 所有拦截器执行完毕 → 调用目标方法
        if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
            return invokeJoinpoint();
        }

        // 获取下一个拦截器
        Object interceptorOrInterceptionAdvice =
            this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);

        // 调用拦截器
        if (interceptorOrInterceptionAdvice instanceof MethodInterceptor) {
            return ((MethodInterceptor) interceptorOrInterceptionAdvice).invoke(this);
        }

        // 跳过非拦截器类型
        return proceed();
    }
}
```

#### 优缺点对比

| 维度 | 使用责任链模式 | 不用责任链模式 |
|------|--------------|---------------|
| 耦合度 | 请求者与处理者解耦 | 请求者需要知道所有处理者 |
| 灵活性 | 动态调整链的顺序和组成 | 处理逻辑硬编码在调用方 |
| 可扩展性 | 新增处理者只需加入链中 | 新增处理需修改调用方代码 |
| 调试难度 | 链式调用相对跟踪较复杂 | 直接调用，调试简单 |

***

### 3.5 迭代器模式（Iterator Pattern）

#### 模式定义

提供一种方法顺序访问一个聚合对象中的各个元素，而又不暴露其内部表示。

#### Spring 中的应用：CompositeIterator

```java
// CompositeIterator — 组合迭代器
public class CompositeIterator<E> implements Iterator<E> {

    private final List<Iterator<E>> iterators = new ArrayList<>();
    private boolean inUse = false;

    public void add(Iterator<E> iterator) {
        checkNotInUse();
        this.iterators.add(iterator);
    }

    @Override
    public boolean hasNext() {
        this.inUse = true;
        // 遍历所有子迭代器，检查是否有下一个元素
        for (Iterator<E> iterator : this.iterators) {
            if (iterator.hasNext()) {
                return true;
            }
        }
        return false;
    }

    @Override
    public E next() {
        this.inUse = true;
        // 找到第一个有下一个元素的子迭代器
        for (Iterator<E> iterator : this.iterators) {
            if (iterator.hasNext()) {
                return iterator.next();
            }
        }
        throw new NoSuchElementException();
    }
}
```

**Spring 中其他迭代器的应用：**

* `org.springframework.util.CompositeIterator`
* `org.springframework.beans.PropertyAccessor` 的属性迭代

***

### 3.6 命令模式（Command Pattern）

#### 模式定义

将请求封装为一个对象，使你可以用不同的请求、队列或日志来参数化其他对象。

* **核心角色**：Command（命令接口）、ConcreteCommand（具体命令）、Invoker（调用者）、Receiver（接收者）

#### Spring 中的应用：回调机制

Spring 中的 `JdbcTemplate` 等模板类大量使用回调（Callback）模式，这是命令模式的一种变体。

```java
// 回调接口 = 命令接口
public interface PreparedStatementCallback<T> {
    T doInPreparedStatement(PreparedStatement ps) throws SQLException, DataAccessException;
}

// 具体命令 = 用户实现回调
PreparedStatementCallback<Integer> callback = new PreparedStatementCallback<Integer>() {
    @Override
    public Integer doInPreparedStatement(PreparedStatement ps) throws SQLException {
        ps.setString(1, "active");
        return ps.executeUpdate();
    }
};

// 调用者 = JdbcTemplate
public class JdbcTemplate {
    public <T> T execute(PreparedStatementCallback<T> action) {
        Connection con = DataSourceUtils.getConnection(dataSource);
        PreparedStatement ps = con.prepareStatement("UPDATE users SET status = ?");
        try {
            // 调用命令（回调）
            return action.doInPreparedStatement(ps);
        } finally {
            JdbcUtils.closeStatement(ps);
        }
    }
}
```

**Spring 中命令模式的其他应用：**

* `TransactionCallback` — 事务操作封装
* `RedisCallback` — Redis 操作封装
* `HibernateCallback` — Hibernate 操作封装
* `StatementCallback` — JDBC Statement 操作封装

***

## 四、设计模式总结

### Spring 设计模式速查表

| 模式分类 | 模式名称 | Spring 中的具体位置 | 典型类/接口 |
|---------|---------|-------------------|------------|
| 创建型 | 单例模式 | IoC 容器默认 Scope | `DefaultSingletonBeanRegistry` |
| 创建型 | 工厂模式 | BeanFactory / FactoryBean | `BeanFactory`, `FactoryBean` |
| 创建型 | 建造者模式 | BeanDefinition 构建 | `BeanDefinitionBuilder` |
| 创建型 | 原型模式 | @Scope("prototype") | `AbstractBeanFactory` |
| 结构型 | 代理模式 | AOP 实现 | `JdkDynamicAopProxy`, `CglibAopProxy` |
| 结构型 | 适配器模式 | HandlerAdapter | `RequestMappingHandlerAdapter` |
| 结构型 | 装饰器模式 | BeanWrapper | `BeanWrapperImpl` |
| 结构型 | 组合模式 | CompositePropertySource | `CompositePropertySource` |
| 结构型 | 外观模式 | 模板类（JdbcTemplate 等） | `JdbcTemplate`, `RestTemplate` |
| 行为型 | 模板方法 | XXXTemplate 系列 | `JdbcTemplate`, `RestTemplate` |
| 行为型 | 观察者模式 | 事件驱动模型 | `ApplicationEvent`, `ApplicationListener` |
| 行为型 | 策略模式 | Resource 访问策略 | `Resource` 接口及其实现类 |
| 行为型 | 责任链模式 | FilterChain / InterceptorChain | `HandlerExecutionChain` |
| 行为型 | 迭代器模式 | CompositeIterator | `CompositeIterator` |
| 行为型 | 命令模式 | 回调机制 | `PreparedStatementCallback` |

### 核心启发

1. **组合优于继承**：Spring 大量使用接口 + 组合（装饰器、策略、适配器）而非继承，提高了灵活性
2. **好莱坞原则**："Don't call us, we'll call you"——模板方法模式让框架控制流程，用户注入行为
3. **开闭原则**：通过代理、装饰器、策略等模式，实现对扩展开放、对修改关闭
4. **关注点分离**：AOP（代理模式）将横切关注点从业务代码中分离，事件机制（观察者模式）将发布者和监听者解耦

理解这些设计模式在 Spring 中的应用，是深入掌握 Spring 框架源码的必经之路。
