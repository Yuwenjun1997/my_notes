---
url: >-
  /my_notes/notes/JAVA学习路线/di-san-jie-duan-jin-jie-neng-li/5-rbac-quan-xian-she-ji/index.md
---
# RBAC 权限设计

> RBAC（Role-Based Access Control，基于角色的访问控制）是企业级系统中最主流的权限模型。它通过"用户-角色-权限"三层结构，实现了灵活、可扩展的权限管理。本文在 [3.3-安全](./3.3-安全.md) 的 Spring Security / JWT / OAuth2 基础上，系统讲解 RBAC 的设计思想与落地实现。

***

## 一、RBAC 核心概念

### 1.1 什么是 RBAC

传统权限分配是"直接给用户授予权限"，当用户和权限数量增长后，管理成本呈指数级上升。RBAC 引入\*\*角色（Role）\*\*作为中间层：权限分配给角色，用户通过被赋予角色来获得权限。

```text
传统模型（ACL）：                    RBAC 模型：
┌──────┐      ┌──────────┐         ┌──────┐      ┌──────┐      ┌──────────┐
│ 用户 │ ───► │ 直接授权  │         │ 用户 │ ───► │ 角色 │ ───► │   权限   │
└──────┘      └──────────┘         └──────┘      └──────┘      └──────────┘

用户 A → 读、写、删除              用户 A → 角色"管理员" → 读、写、删除
用户 B → 读、写                    用户 B → 角色"编辑"   → 读、写
用户 C → 读                        用户 C → 角色"访客"   → 读
```

**核心优势**：

* **解耦**：用户与权限不直接关联，变更角色即可批量调整权限
* **最小权限原则**：每个角色只拥有完成职责所需的最小权限集
* **职责分离**：通过角色约束避免权力过于集中
* **审计友好**：权限变更以角色为单位，易于追踪

### 1.2 RBAC 模型级别

NIST 标准将 RBAC 划分为四个递进级别：

| 级别 | 名称 | 核心特性 | 适用场景 |
|:-----|:-----|:---------|:---------|
| RBAC0 | 基础模型 | 用户-角色-权限多对多关联 | 中小型系统，权限需求简单 |
| RBAC1 | 角色继承 | 在 RBAC0 基础上增加角色层级继承 | 需要上下级权限继承的组织 |
| RBAC2 | 约束模型 | 在 RBAC0 基础上增加互斥角色、数量限制 | 金融、审计等合规要求高的系统 |
| RBAC3 | 完整模型 | 同时具备 RBAC1 + RBAC2 的能力 | 大型企业级系统 |

```text
RBAC3 = RBAC1（角色继承） + RBAC2（约束）
              │                      │
              ▼                      ▼
        ┌──────────┐          ┌──────────┐
        │ 角色层级  │          │ 互斥约束  │
        │ 权限继承  │          │ 基数限制  │
        │ 上下级关系 │          │ 先决条件  │
        └──────────┘          └──────────┘
              │                      │
              └──────┬───────────────┘
                     ▼
              ┌──────────┐
              │  RBAC0   │
              │ 基础模型  │
              └──────────┘
```

**RBAC1 — 角色继承示例**：

```text
        ┌──────────────┐
        │  超级管理员   │   继承所有下级角色的权限
        └──────┬───────┘
               │
        ┌──────┴───────┐
        │  系统管理员   │   继承普通用户权限 + 额外管理权限
        └──────┬───────┘
               │
        ┌──────┴───────┐
        │   普通用户    │   基础权限（查看、编辑个人信息）
        └──────────────┘
```

**RBAC2 — 互斥约束示例**：

* **静态职责分离（SSD）**：同一用户不能同时被赋予"会计"和"审计"角色
* **动态职责分离（DSD）**：同一用户可以在不同时间拥有互斥角色，但不能在同一次会话中同时激活

### 1.3 RBAC vs ACL 对比

| 对比维度 | RBAC | ACL（访问控制列表） |
|:---------|:-----|:--------------------|
| 权限分配方式 | 权限 → 角色 → 用户 | 权限 → 用户（直接绑定） |
| 管理粒度 | 粗粒度（按角色批量管理） | 细粒度（逐用户/逐资源管理） |
| 可扩展性 | 高（新增用户只需分配角色） | 低（每个用户需单独授权） |
| 适用场景 | 企业管理系统、后台权限 | 文件系统、操作系统级权限 |
| 审计追踪 | 容易（角色变更记录清晰） | 困难（权限分散在各资源上） |
| 实现复杂度 | 中等（需要角色管理层） | 简单（直接匹配用户-权限） |

```text
选择建议：
├─ 用户量 > 50，角色类型明确 → 选 RBAC
├─ 只有几种固定权限，简单控制 → ACL 足够
├─ 企业级后台管理系统 → RBAC 是标配
└─ 文件/目录级别的权限控制 → ACL 更自然
```

***

## 二、数据库设计

### 2.1 核心五表模型

RBAC 最经典的是**五表模型**：三张实体表（用户、角色、权限）+ 两张关联表（用户-角色、角色-权限）。

```text
┌──────────┐    ┌──────────────┐    ┌──────────┐
│ sys_user │    │sys_user_role │    │ sys_role │
├──────────┤    ├──────────────┤    ├──────────┤
│ id (PK)  │◄──┤ user_id (FK) │    │ id (PK)  │
│ username │    │ role_id (FK) │──► │ role_name│
│ password │    └──────────────┘    │ role_key │
│ nickname │                        │ sort     │
│ status   │                        │ status   │
└──────────┘                        └────┬─────┘
                                         │
                                  ┌──────┴───────┐
                                  │sys_role_perm │
                                  ├──────────────┤
                                  │ role_id (FK) │◄──┐
                                  │ perm_id (FK) │──►│
                                  └──────────────┘   │
                                              ┌──────┴──────┐
                                              │sys_permission│
                                              ├─────────────┤
                                              │ id (PK)     │
                                              │ perm_name   │
                                              │ perm_key    │
                                              │ type        │
                                              │ parent_id   │
                                              │ path        │
                                              │ sort        │
                                              │ status      │
                                              └─────────────┘
```

### 2.2 建表 SQL

```sql
-- ========================================
-- 1. 用户表
-- ========================================
CREATE TABLE `sys_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL COMMENT '用户名',
  `password` VARCHAR(128) NOT NULL COMMENT '密码（BCrypt）',
  `nickname` VARCHAR(64) DEFAULT '' COMMENT '昵称',
  `email` VARCHAR(128) DEFAULT '' COMMENT '邮箱',
  `phone` VARCHAR(20) DEFAULT '' COMMENT '手机号',
  `avatar` VARCHAR(256) DEFAULT '' COMMENT '头像 URL',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ========================================
-- 2. 角色表
-- ========================================
CREATE TABLE `sys_role` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `role_name` VARCHAR(64) NOT NULL COMMENT '角色名称',
  `role_key` VARCHAR(64) NOT NULL COMMENT '角色标识（如 ADMIN）',
  `parent_id` BIGINT DEFAULT 0 COMMENT '父角色 ID（RBAC1 层级继承）',
  `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `remark` VARCHAR(256) DEFAULT '' COMMENT '备注',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_key` (`role_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- ========================================
-- 3. 权限表（菜单/按钮/API 权限统一管理）
-- ========================================
CREATE TABLE `sys_permission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `perm_name` VARCHAR(64) NOT NULL COMMENT '权限名称',
  `perm_key` VARCHAR(128) NOT NULL COMMENT '权限标识（如 user:create）',
  `type` TINYINT NOT NULL COMMENT '类型：1-目录 2-菜单 3-按钮/API',
  `parent_id` BIGINT DEFAULT 0 COMMENT '父级 ID（树形结构）',
  `path` VARCHAR(256) DEFAULT '' COMMENT '路由路径',
  `component` VARCHAR(256) DEFAULT '' COMMENT '前端组件路径',
  `icon` VARCHAR(64) DEFAULT '' COMMENT '菜单图标',
  `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_perm_key` (`perm_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表';

-- ========================================
-- 4. 用户-角色关联表
-- ========================================
CREATE TABLE `sys_user_role` (
  `user_id` BIGINT NOT NULL COMMENT '用户 ID',
  `role_id` BIGINT NOT NULL COMMENT '角色 ID',
  PRIMARY KEY (`user_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-角色关联表';

-- ========================================
-- 5. 角色-权限关联表
-- ========================================
CREATE TABLE `sys_role_permission` (
  `role_id` BIGINT NOT NULL COMMENT '角色 ID',
  `perm_id` BIGINT NOT NULL COMMENT '权限 ID',
  PRIMARY KEY (`role_id`, `perm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色-权限关联表';
```

> **设计要点**：`sys_role` 的 `parent_id` 用于 RBAC1 角色继承；`sys_permission` 的 `type` 字段区分目录/菜单/按钮三级，支撑前端菜单渲染和按钮级权限控制。

### 2.3 权限类型说明

`sys_permission.type` 字段的三种取值对应不同的权限粒度：

| type 值 | 类型 | 说明 | 示例 |
|:--------|:-----|:-----|:-----|
| 1 | 目录 | 一级导航分组，无实际权限意义 | "系统管理"、"用户管理" |
| 2 | 菜单 | 页面级权限，控制能否访问某个页面 | "用户列表"、"角色管理" |
| 3 | 按钮/API | 操作级权限，控制能否执行某个操作 | `user:create`、`role:delete` |

```text
权限树结构示例：
├── 系统管理（type=1, 目录）
│   ├── 用户管理（type=2, 菜单）
│   │   ├── 新增用户（type=3, 按钮, perm_key=user:create）
│   │   ├── 编辑用户（type=3, 按钮, perm_key=user:update）
│   │   └── 删除用户（type=3, 按钮, perm_key=user:delete）
│   └── 角色管理（type=2, 菜单）
│       ├── 新增角色（type=3, 按钮, perm_key=role:create）
│       └── 分配权限（type=3, 按钮, perm_key=role:assign）
└── 数据监控（type=1, 目录）
    ├── 操作日志（type=2, 菜单）
    └── 登录日志（type=2, 菜单）
```

### 2.4 初始化数据 SQL

```sql
-- 初始化角色
INSERT INTO `sys_role` (`id`, `role_name`, `role_key`, `parent_id`, `sort`) VALUES
(1, '超级管理员', 'SUPER_ADMIN', 0, 1),
(2, '系统管理员', 'ADMIN', 1, 2),
(3, '普通用户',   'USER', 0, 3);

-- 初始化权限（目录 → 菜单 → 按钮）
INSERT INTO `sys_permission` (`id`, `perm_name`, `perm_key`, `type`, `parent_id`, `path`, `sort`) VALUES
-- 系统管理目录
(1,  '系统管理',   'system',        1, 0, '/system',       1),
-- 用户管理
(2,  '用户管理',   'user',          2, 1, '/system/user',  1),
(3,  '新增用户',   'user:create',   3, 2, '',              1),
(4,  '编辑用户',   'user:update',   3, 2, '',              2),
(5,  '删除用户',   'user:delete',   3, 2, '',              3),
-- 角色管理
(6,  '角色管理',   'role',          2, 1, '/system/role',  2),
(7,  '新增角色',   'role:create',   3, 6, '',              1),
(8,  '分配权限',   'role:assign',   3, 6, '',              2);

-- 超级管理员拥有所有权限
INSERT INTO `sys_role_permission` (`role_id`, `perm_id`) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8);

-- 系统管理员拥有用户管理和角色管理的查看权限
INSERT INTO `sys_role_permission` (`role_id`, `perm_id`) VALUES
(2,1),(2,2),(2,6);

-- 普通用户只能查看用户管理页面
INSERT INTO `sys_role_permission` (`role_id`, `perm_id`) VALUES
(3,1),(3,2);

-- 分配用户-角色
INSERT INTO `sys_user_role` (`user_id`, `role_id`) VALUES
(1, 1),   -- 用户1 → 超级管理员
(2, 2),   -- 用户2 → 系统管理员
(3, 3);   -- 用户3 → 普通用户
```

***

## 三、Spring Security + RBAC 实现

> 本节假设你已熟悉 [3.3-安全](./3.3-安全.md) 中 Spring Security 的过滤器链、UserDetailsService 和 JWT 基础。此处聚焦于 RBAC 特有的数据库驱动权限加载。

### 3.1 实体类

```java
@Data
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String password;
    private String nickname;
    private String email;
    private String phone;
    private String avatar;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

@Data
@TableName("sys_role")
public class SysRole {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String roleName;
    private String roleKey;
    private Long parentId;
    private Integer sort;
    private Integer status;
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

@Data
@TableName("sys_permission")
public class SysPermission {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String permName;
    private String permKey;
    private Integer type;        // 1-目录 2-菜单 3-按钮/API
    private Long parentId;
    private String path;
    private String component;
    private String icon;
    private Integer sort;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

@Data
@TableName("sys_user_role")
public class SysUserRole {
    private Long userId;
    private Long roleId;
}

@Data
@TableName("sys_role_permission")
public class SysRolePermission {
    private Long roleId;
    private Long permId;
}
```

### 3.2 Mapper 层

```java
@Mapper
public interface SysUserMapper {

    /**
     * 根据用户名查询用户（含角色和权限）
     */
    @Select("""
        SELECT u.* FROM sys_user u WHERE u.username = #{username} AND u.status = 1
    """)
    SysUser findByUsername(@Param("username") String username);

    /**
     * 查询用户的角色标识列表
     */
    @Select("""
        SELECT r.role_key FROM sys_role r
        INNER JOIN sys_user_role ur ON ur.role_id = r.id
        WHERE ur.user_id = #{userId} AND r.status = 1
    """)
    List<String> findRoleKeysByUserId(@Param("userId") Long userId);

    /**
     * 查询用户的权限标识列表（去重）
     */
    @Select("""
        SELECT DISTINCT p.perm_key FROM sys_permission p
        INNER JOIN sys_role_permission rp ON rp.perm_id = p.id
        INNER JOIN sys_user_role ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = #{userId} AND p.status = 1
    """)
    List<String> findPermKeysByUserId(@Param("userId") Long userId);

    /**
     * 查询用户的菜单列表（type=1目录 + type=2菜单）
     */
    @Select("""
        SELECT DISTINCT p.* FROM sys_permission p
        INNER JOIN sys_role_permission rp ON rp.perm_id = p.id
        INNER JOIN sys_user_role ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = #{userId} AND p.type IN (1, 2) AND p.status = 1
        ORDER BY p.sort
    """)
    List<SysPermission> findMenusByUserId(@Param("userId") Long userId);
}
```

> **性能提示**：上面是简化写法。生产环境建议用 MyBatis XML Mapper 编写复杂 JOIN 查询，避免 N+1 问题。

### 3.3 Service 层 — RbacUserDetailsService

```java
@Service
@RequiredArgsConstructor
public class RbacUserDetailsService implements UserDetailsService {

    private final SysUserMapper userMapper;

    @Override
    public UserDetails loadUserByUsername(String username)
            throws UsernameNotFoundException {

        // 1. 查询用户基本信息
        SysUser user = userMapper.findByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("用户不存在: " + username);
        }

        // 2. 查询角色和权限
        List<String> roleKeys = userMapper.findRoleKeysByUserId(user.getId());
        List<String> permKeys = userMapper.findPermKeysByUserId(user.getId());

        // 3. 构建权限集合
        Set<GrantedAuthority> authorities = new HashSet<>();

        // 角色（Spring Security 约定 ROLE_ 前缀）
        for (String roleKey : roleKeys) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + roleKey));
        }

        // 权限标识（如 user:create, role:delete）
        for (String permKey : permKeys) {
            authorities.add(new SimpleGrantedAuthority(permKey));
        }

        // 4. 封装为 UserDetails
        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                user.getStatus() == 1,   // 账号是否启用
                true, true, true,        // 账号/凭证/未锁定
                authorities
        );
    }
}
```

### 3.4 动态权限评估器

不再在 SecurityConfig 中硬编码 URL-权限映射，而是从数据库动态加载：

```java
@Component("rbacPermission")
@RequiredArgsConstructor
public class RbacPermissionEvaluator implements PermissionEvaluator {

    private final SysUserMapper userMapper;

    /**
     * hasPermission(Object, Object) — 用于 @PreAuthorize
     * 判断当前用户是否拥有指定权限标识
     */
    @Override
    public boolean hasPermission(Authentication authentication,
                                  Object targetDomainObject,
                                  Object permission) {
        if (!(authentication.getPrincipal() instanceof UserDetails)) {
            return false;
        }

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String permKey = (String) permission;

        // 从数据库查询用户的权限（生产环境应走缓存）
        SysUser user = userMapper.findByUsername(userDetails.getUsername());
        List<String> permissions = userMapper.findPermKeysByUserId(user.getId());

        return permissions.contains(permKey);
    }

    /**
     * hasPermission(Authentication, Serializable, String, Object)
     * 用于基于 URL 和 HTTP 方法的细粒度控制
     */
    @Override
    public boolean hasPermission(Authentication authentication,
                                  Serializable targetId,
                                  String targetType,
                                  Object permission) {
        // targetType = "URL", permission = HTTP method
        // 可结合自定义注解实现更复杂的 URL 级别权限控制
        return hasPermission(authentication, targetType, permission);
    }
}
```

**Controller 中使用**：

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // 方式1：直接校验权限标识
    @PreAuthorize("@rbacPermission.hasPermission(authentication, '', 'user:create')")
    @PostMapping
    public Result<SysUser> create(@Valid @RequestBody UserCreateRequest request) {
        return Result.success(userService.create(request));
    }

    // 方式2：使用 Spring Security 内置表达式（更简洁）
    @PreAuthorize("hasAuthority('user:update')")
    @PutMapping("/{id}")
    public Result<SysUser> update(@PathVariable Long id,
                                   @RequestBody UserUpdateRequest request) {
        return Result.success(userService.update(id, request));
    }

    // 方式3：组合条件（权限 + 数据归属）
    @PreAuthorize("hasAuthority('user:delete') and @rbacPermission.hasPermission(authentication, '', 'user:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.success();
    }

    // 无需权限标注 — 只要登录即可
    @GetMapping("/me")
    public Result<UserInfo> getCurrentUser() {
        return Result.success(userService.getCurrentUser());
    }
}
```

### 3.5 SecurityConfig 配置

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final RbacUserDetailsService userDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s ->
                s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // 其余接口：登录即可访问，具体权限由 @PreAuthorize 控制
                .anyRequest().authenticated()
            )

            // 使用自定义 UserDetailsService
            .userDetailsService(userDetailsService)

            // 异常处理
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, resp, e) -> {
                    resp.setContentType("application/json;charset=utf-8");
                    resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    resp.getWriter().write("{\"code\":401,\"msg\":\"未登录\"}");
                })
                .accessDeniedHandler((req, resp, e) -> {
                    resp.setContentType("application/json;charset=utf-8");
                    resp.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    resp.getWriter().write("{\"code\":403,\"msg\":\"权限不足\"}");
                })
            )

            .addFilterBefore(jwtAuthenticationFilter,
                    UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

> **设计要点**：URL 层只做"是否登录"的判断，具体业务权限交给 `@PreAuthorize` + 数据库动态加载，实现**控制分离**。

### 3.6 菜单树查询 API

前端根据用户权限动态渲染侧边栏菜单：

```java
@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final SysUserMapper userMapper;

    /**
     * 获取当前用户的菜单树（用于前端侧边栏渲染）
     */
    @GetMapping("/tree")
    public Result<List<MenuVO>> getMenuTree() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<SysPermission> menus = userMapper.findMenusByUserId(userId);
        return Result.success(buildMenuTree(menus, 0L));
    }

    /**
     * 获取当前用户的权限标识列表（用于前端按钮级控制）
     */
    @GetMapping("/permissions")
    public Result<List<String>> getPermKeys() {
        Long userId = SecurityUtils.getCurrentUserId();
        return Result.success(userMapper.findPermKeysByUserId(userId));
    }

    /**
     * 递归构建菜单树
     */
    private List<MenuVO> buildMenuTree(List<SysPermission> menus, Long parentId) {
        return menus.stream()
                .filter(m -> parentId.equals(m.getParentId()))
                .sorted(Comparator.comparingInt(SysPermission::getSort))
                .map(m -> new MenuVO(
                        m.getId(), m.getPermName(), m.getPath(),
                        m.getComponent(), m.getIcon(), m.getType(),
                        buildMenuTree(menus, m.getId())
                ))
                .collect(Collectors.toList());
    }
}

@Data
@AllArgsConstructor
public class MenuVO {
    private Long id;
    private String name;
    private String path;
    private String component;
    private String icon;
    private Integer type;
    private List<MenuVO> children;
}
```

**前端按钮级权限控制示例（Vue 3）**：

```javascript
// permission.js — 全局权限指令
const permission = {
    mounted(el, binding) {
        const { value } = binding
        const permissions = JSON.parse(sessionStorage.getItem('permissions') || '[]')
        if (value && !permissions.includes(value)) {
            el.parentNode?.removeChild(el)  // 无权限则移除按钮
        }
    }
}

// 使用方式
// <button v-permission="'user:create'">新增用户</button>
// <button v-permission="'user:delete'">删除</button>
```

***

## 四、进阶模式

### 4.1 数据级权限（行级数据过滤）

在 RBAC 基础上，进一步控制用户能访问**哪些数据行**。典型场景：部门经理只能看本部门数据，普通员工只能看自己的数据。

**方案：MyBatis 拦截器 + 自定义注解**

```java
// 1. 自定义注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DataScope {
    /** 部门表的别名 */
    String deptAlias() default "";
    /** 用户表的别名 */
    String userAlias() default "";
}

// 2. 数据范围枚举
public enum DataScopeType {
    ALL,                    // 全部数据
    DEPT,                   // 本部门数据
    DEPT_AND_CHILD,         // 本部门及子部门数据
    SELF                    // 仅本人数据
}

// 3. MyBatis 拦截器
@Intercepts({
    @Signature(type = StatementHandler.class,
               method = "prepare",
               args = {Connection.class, Integer.class})
})
@Component
public class DataScopeInterceptor implements Interceptor {

    private static final ThreadLocal<String> DATA_SCOPE_FILTER = new ThreadLocal<>();

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        String sql = getOriginalSql(invocation);
        String dataScope = DATA_SCOPE_FILTER.get();

        if (dataScope != null && !dataScope.isEmpty()) {
            // 在原始 SQL 后追加数据过滤条件
            // 例：AND dept_id IN (SELECT id FROM sys_dept WHERE id = #{currentDeptId})
            String newSql = sql + " " + dataScope;
            setSql(invocation, newSql);
        }

        try {
            return invocation.proceed();
        } finally {
            DATA_SCOPE_FILTER.remove();
        }
    }

    public static void setFilter(String filter) {
        DATA_SCOPE_FILTER.set(filter);
    }
}
```

**Service 层使用**：

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderMapper orderMapper;

    @DataScope(deptAlias = "o", userAlias = "o")
    public List<Order> listOrders(OrderQuery query) {
        // MyBatis 拦截器会自动拼接数据权限 SQL
        // 例如自动追加：WHERE o.create_by = #{currentUserId}
        return orderMapper.selectList(query);
    }
}
```

### 4.2 权限缓存（Redis）

每次请求都查库加载权限性能较差，使用 Redis 缓存权限数据：

```java
@Service
@RequiredArgsConstructor
public class RbacCacheService {

    private final StringRedisTemplate redisTemplate;
    private final SysUserMapper userMapper;

    private static final String PERM_CACHE_PREFIX = "rbac:perms:";
    private static final String ROLE_CACHE_PREFIX = "rbac:roles:";
    private static final String MENU_CACHE_PREFIX = "rbac:menus:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    /**
     * 获取用户权限（优先缓存）
     */
    public List<String> getPermKeys(Long userId) {
        String key = PERM_CACHE_PREFIX + userId;
        List<String> cached = redisTemplate.opsForList().range(key, 0, -1);

        if (cached != null && !cached.isEmpty()) {
            return cached;
        }

        // 缓存未命中，查库并写入缓存
        List<String> permKeys = userMapper.findPermKeysByUserId(userId);
        if (!permKeys.isEmpty()) {
            redisTemplate.opsForList().rightPushAll(key, permKeys);
            redisTemplate.expire(key, CACHE_TTL);
        }
        return permKeys;
    }

    /**
     * 权限变更时清除缓存（角色分配/权限修改后调用）
     */
    public void clearUserCache(Long userId) {
        redisTemplate.delete(
            PERM_CACHE_PREFIX + userId,
            ROLE_CACHE_PREFIX + userId,
            MENU_CACHE_PREFIX + userId
        );
    }

    /**
     * 角色权限变更时，清除所有拥有该角色的用户缓存
     */
    public void clearCacheByRoleId(Long roleId) {
        // 查询所有拥有该角色的用户 ID
        List<Long> userIds = userMapper.findUserIdsByRoleId(roleId);
        userIds.forEach(this::clearUserCache);
    }
}
```

**权限变更时触发缓存清理**：

```java
@Service
@RequiredArgsConstructor
public class RoleService {

    private final SysRoleMapper roleMapper;
    private final RbacCacheService cacheService;

    /**
     * 修改角色的权限分配后，清除相关用户缓存
     */
    public void updateRolePermissions(Long roleId, List<Long> permIds) {
        // 1. 更新数据库
        roleMapper.deleteRolePermissions(roleId);
        permIds.forEach(permId -> roleMapper.insertRolePermission(roleId, permId));

        // 2. 清除缓存
        cacheService.clearCacheByRoleId(roleId);
    }
}
```

### 4.3 角色层级（RBAC1 角色继承）

`sys_role` 表的 `parent_id` 字段支持角色层级继承：

```java
@Service
@RequiredArgsConstructor
public class RoleHierarchyService {

    private final SysRoleMapper roleMapper;

    /**
     * 递归查询角色的所有子角色（含自身）
     * 例：超级管理员 → 系统管理员 → 普通用户
     * 分配"超级管理员"时，自动拥有所有子角色的权限
     */
    public Set<String> resolveRolePermissions(Long roleId) {
        Set<String> allPerms = new HashSet<>();
        Set<Long> roleIds = new HashSet<>();
        collectRoleIds(roleId, roleIds);

        // 查询所有相关角色的权限
        for (Long id : roleIds) {
            allPerms.addAll(roleMapper.findPermKeysByRoleId(id));
        }
        return allPerms;
    }

    private void collectRoleIds(Long roleId, Set<Long> collected) {
        if (collected.contains(roleId)) return;  // 防止循环引用
        collected.add(roleId);

        List<SysRole> children = roleMapper.findByParentId(roleId);
        for (SysRole child : children) {
            collectRoleIds(child.getId(), collected);
        }
    }
}
```

### 4.4 菜单级 + 按钮级权限（前后端配合）

```text
后端职责：
├── /api/menus/tree     → 返回用户可见的菜单树（type=1目录 + type=2菜单）
├── /api/menus/permissions → 返回用户的权限标识列表（type=3按钮/API 的 perm_key）
└── @PreAuthorize       → 接口级权限校验

前端职责：
├── 路由守卫            → 根据菜单树动态注册路由
├── 侧边栏渲染          → 根据菜单树渲染导航菜单
└── v-permission 指令   → 根据权限标识列表控制按钮显示/隐藏
```

**完整的权限加载流程**：

```text
用户登录（JWT）
    │
    ▼
前端存储 Token → 请求 /api/menus/tree 和 /api/menus/permissions
    │
    ▼
后端解析 JWT → 获取 userId → 查询数据库/缓存 → 返回菜单树 + 权限列表
    │
    ▼
前端渲染：
├── 路由守卫：根据菜单树动态添加路由（addRoute）
├── 侧边栏：根据菜单树渲染导航
└── 按钮：v-permission="'user:create'" 控制显示
    │
    ▼
用户点击操作 → 后端 @PreAuthorize 二次校验（防止绕过前端直接调接口）
```

***

## 五、常见坑与避坑指南

| 坑 | 说明 | 避坑方式 |
|:---|:-----|:---------|
| 权限粒度过粗 | 只设计了角色，没有独立的权限表，无法细粒度控制 | 必须有独立的 `sys_permission` 表，支持按钮/API 级别 |
| 硬编码权限映射 | SecurityConfig 中写死 `requestMatchers("/api/admin/**").hasRole("ADMIN")` | 使用 `@PreAuthorize` + 数据库动态加载 |
| 缓存不一致 | 修改角色权限后，缓存未更新导致用户仍持有旧权限 | 权限变更时主动清除相关用户缓存（Redis 发布/订阅通知多实例） |
| N+1 查询 | 逐个查询用户的角色、权限，每次一个 SQL | 用一条多表 JOIN SQL 或 IN 批量查询 |
| 忘记二次校验 | 只在前端做了按钮隐藏，没在后端接口加 `@PreAuthorize` | 前端控制显示，后端必须二次校验，防止绕过 |
| 超级管理员遗漏 | 超级管理员走了"无角色"逻辑导致无权限 | 超级管理员也是普通角色，通过角色标识判断而非特殊逻辑 |
| 角色互斥未处理 | 同一人拥有互斥角色（如"申请人"和"审批人"） | 引入 RBAC2 约束，在分配角色时校验互斥规则 |
| 权限树循环引用 | `parent_id` 形成环导致递归死循环 | `collectRoleIds` 中用 Set 记录已访问节点，防止循环 |
| 大量权限拖慢登录 | 用户角色多时权限查询耗时长 | 权限数据走 Redis 缓存，登录时异步加载 |
| 密码存明文 | 用户密码没有加密存储 | 使用 `BCryptPasswordEncoder`，密码不可逆加密 |

***

## 六、实践项目

### 项目 1：RBAC 权限管理系统

**目标**：实现完整的 RBAC 权限管理后端，理解权限模型的全貌。

**功能要求**：

1. 用户管理（CRUD，启用/禁用，分配角色）
2. 角色管理（CRUD，启用/禁用，分配权限）
3. 权限/菜单管理（树形结构 CRUD，支持目录/菜单/按钮三级）
4. 登录后动态加载用户权限和菜单（JWT + Redis 缓存）
5. 基于 `@PreAuthorize` 的接口级权限控制
6. 前端按钮级权限标识返回

**技术选型**：Spring Boot + Spring Security + MyBatis-Plus + MySQL + Redis

**核心接口**：

| 接口 | 方法 | 权限 | 说明 |
|:-----|:-----|:-----|:-----|
| `/api/auth/login` | POST | 公开 | 登录，返回 JWT |
| `/api/users` | GET | `user:list` | 用户列表 |
| `/api/users` | POST | `user:create` | 新增用户 |
| `/api/roles` | GET | `role:list` | 角色列表 |
| `/api/roles` | POST | `role:create` | 新增角色 |
| `/api/roles/{id}/permissions` | PUT | `role:assign` | 分配权限 |
| `/api/menus/tree` | GET | 登录即可 | 获取菜单树 |
| `/api/menus/permissions` | GET | 登录即可 | 获取权限标识列表 |

### 项目 2：数据级权限控制

**目标**：在 RBAC 基础上实现行级数据过滤。

**功能要求**：

1. 定义数据权限规则（全部数据、本部门数据、本部门及子部门、仅本人）
2. 通过 `@DataScope` 注解标记需要数据过滤的方法
3. MyBatis 拦截器自动拼接数据范围 SQL
4. 支持部门层级数据继承
5. Redis 缓存用户权限和数据范围配置

**技术选型**：Spring Boot + MyBatis 拦截器 + Redis

**扩展思考**：

* 如何在微服务架构下统一管理 RBAC 权限？（Spring Cloud + 统一认证中心）
* 如何实现 RBAC 的审计日志？（谁在什么时候修改了什么权限）
* 如何支持多租户的权限隔离？（租户维度的数据隔离）

***

## 📚 参考资料

* [Spring Security 官方文档](https://docs.spring.io/spring-security/reference/)
* [NIST RBAC 标准 (ANSI/INCITS 359-2008)](https://csrc.nist.gov/projects/access-control-model-project)
* [RBAC 维基百科](https://en.wikipedia.org/wiki/Role-based_access_control)
* [Apache Shiro 官方文档](https://shiro.apache.org/)
* [Sa-Token 权限认证框架](https://sa-token.cc/)
