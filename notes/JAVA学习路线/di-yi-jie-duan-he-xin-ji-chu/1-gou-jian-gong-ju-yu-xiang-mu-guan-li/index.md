---
url: >-
  /my_notes/notes/JAVA学习路线/di-yi-jie-duan-he-xin-ji-chu/1-gou-jian-gong-ju-yu-xiang-mu-guan-li/index.md
---
# 构建工具与项目管理

## 一、Maven 详解

### 1.1 Maven 核心概念

Maven 是一个项目管理和构建工具，核心功能包括：

**依赖管理（pom.xml）**

Maven 使用 `pom.xml`（Project Object Model）文件来管理项目配置。一个典型的 `pom.xml` 结构如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <!-- 项目坐标：唯一标识一个项目 -->
    <groupId>com.example</groupId>          <!-- 组织/公司名 -->
    <artifactId>my-app</artifactId>         <!-- 项目名 -->
    <version>1.0.0-SNAPSHOT</version>       <!-- 版本号 -->
    <packaging>jar</packaging>              <!-- 打包方式：jar/war/pom -->

    <!-- 属性定义 -->
    <properties>
        <java.version>17</java.version>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <!-- 依赖管理 -->
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>3.2.0</version>
        </dependency>
    </dependencies>
</project>
```

**依赖范围（Scope）**

| 范围 | 说明 | 示例 |
|------|------|------|
| `compile`（默认） | 编译、测试、运行都有效 | 项目核心依赖 |
| `provided` | 编译时需要，运行时由容器提供 | Servlet API |
| `runtime` | 编译不需要，运行时需要 | MySQL JDBC 驱动 |
| `test` | 仅测试阶段有效 | JUnit |
| `system` | 类似 provided，需显式指定路径 | 本地jar包 |

**依赖传递与排除**

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>example-lib</artifactId>
    <version>1.0.0</version>
    <!-- 排除传递性依赖 -->
    <exclusions>
        <exclusion>
            <groupId>com.old</groupId>
            <artifactId>old-lib</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

### 1.2 Maven 生命周期

Maven 有三套生命周期，每套包含多个阶段（Phase）：

**Clean 生命周期**：清理项目

* `pre-clean` → `clean`（删除 target 目录）→ `post-clean`

**Default 生命周期**（核心生命周期）：

```
validate → compile → test → package → verify → install → deploy
```

详解：

1. **validate**：验证项目配置是否正确
2. **compile**：编译源代码到 `target/classes`
3. **test**：运行测试代码（使用 `target/test-classes`）
4. **package**：打包为 jar/war
5. **verify**：运行检查以验证包有效
6. **install**：将包安装到本地仓库（`~/.m2/repository`）
7. **deploy**：将包部署到远程仓库

**Site 生命周期**：生成项目报告和文档

* `pre-site` → `site` → `post-site` → `site-deploy`

### 1.3 多模块项目配置

**父 POM 配置**

```xml
<!-- parent-pom/pom.xml -->
<project>
    <groupId>com.example</groupId>
    <artifactId>parent-project</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>  <!-- 父模块必须是 pom 类型 -->

    <modules>
        <module>common</module>
        <module>web</module>
        <module>service</module>
    </modules>

    <!-- 统一依赖管理 -->
    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>3.2.0</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>
```

**子模块配置**

```xml
<!-- common/pom.xml -->
<project>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent-project</artifactId>
        <version>1.0.0</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <artifactId>common</artifactId>
    <!-- 子模块自动继承父模块的 groupId 和 version -->
</project>
```

**模块间依赖**

```xml
<!-- web/pom.xml -->
<project>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent-project</artifactId>
        <version>1.0.0</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <artifactId>web</artifactId>

    <dependencies>
        <!-- 依赖兄弟模块 -->
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>common</artifactId>
        </dependency>
    </dependencies>
</project>
```

**项目目录结构**

```
parent-project/
├── pom.xml              # 父 POM
├── common/
│   └── pom.xml          # 公共工具模块
├── service/
│   └── pom.xml          # 业务逻辑模块
└── web/
    └── pom.xml          # Web 接口模块
```

### 1.4 Maven 常用命令

```bash
# 清理并编译
mvn clean compile

# 清理并打包（跳过测试）
mvn clean package -DskipTests

# 安装到本地仓库
mvn clean install

# 多模块构建（仅构建某个模块及其依赖）
mvn clean install -pl web -am

# 查看依赖树
mvn dependency:tree

# 查看有效 POM（合并所有父 POM 后的最终配置）
mvn help:effective-pom

# 下载源码和文档
mvn dependency:sources
mvn dependency:javadoc
```

### 1.5 Maven 常用插件

```xml
<!-- 编译插件 -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.11.0</version>
    <configuration>
        <source>17</source>
        <target>17</target>
    </configuration>
</plugin>

<!-- 打包插件（Spring Boot） -->
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>
                <groupId>org.projectlombok</groupId>
                <artifactId>lombok</artifactId>
            </exclude>
        </excludes>
    </configuration>
</plugin>

<!-- 测试覆盖率插件 -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>verify</phase>
            <goals><goal>report</goal></goals>
        </execution>
    </executions>
</plugin>
```

***

## 二、Gradle 详解

### 2.1 Gradle 基础概念

Gradle 是一个基于 Groovy/Kotlin DSL 的构建工具，相比 Maven 更灵活、更快速。

**build.gradle 基础结构（Groovy DSL）**

```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'io.spring.dependency-management' version '1.1.4'
}

group = 'com.example'
version = '1.0.0-SNAPSHOT'

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

repositories {
    mavenCentral()
    maven { url 'https://repo.spring.io/milestone' }
}

dependencies {
    // 编译期依赖
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'

    // 运行时依赖
    runtimeOnly 'com.mysql:mysql-connector-j'

    // 编译期需要但不会打包的依赖
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'

    // 测试依赖
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

// 自定义任务
task hello {
    doLast {
        println 'Hello, Gradle!'
    }
}
```

**Gradle Wrapper**

确保团队使用同一版本构建：

```bash
# 生成 Wrapper（项目目录下执行）
gradle wrapper --gradle-version=8.5

# 生成的文件：
# gradlew          (Unix shell 脚本)
# gradlew.bat      (Windows 批处理)
# gradle/wrapper/gradle-wrapper.jar
# gradle/wrapper/gradle-wrapper.properties

# 使用 Wrapper 构建（不需要本地安装 Gradle）
./gradlew build
# Windows 下
gradlew.bat build
```

### 2.2 Gradle 任务（Task）

**创建自定义任务**

```groovy
// 简单的任务定义
task printVersion {
    description = '打印项目版本'
    group = 'help'
    doLast {
        println "项目版本: ${version}"
    }
}

// 依赖其他任务
task buildInfo(dependsOn: printVersion) {
    doLast {
        println "生成构建信息..."
        file("build-info.txt").text = "Version: ${version}\nDate: ${new Date()}"
    }
}

// 类型化任务
task copyResources(type: Copy) {
    from 'src/main/resources'
    into 'build/resources'
    include '**/*.properties'
    exclude '**/*.secret'
}

task createJar(type: Jar) {
    archiveBaseName = 'my-app'
    archiveVersion = version
    from sourceSets.main.output
    manifest {
        attributes 'Main-Class': 'com.example.Application'
    }
}
```

### 2.3 Gradle 多模块项目

**settings.gradle**

```groovy
rootProject.name = 'parent-project'

include 'common'
include 'service'
include 'web'

// 指定子模块目录（如果不在根目录下）
// include 'web'
// project(':web').projectDir = file('applications/web')
```

**根目录 build.gradle**

```groovy
// 通用配置，所有子模块都适用
allprojects {
    group = 'com.example'
    version = '1.0.0-SNAPSHOT'

    repositories {
        mavenCentral()
    }
}

// 子模块通用配置
subprojects {
    apply plugin: 'java'

    java {
        sourceCompatibility = JavaVersion.VERSION_17
    }

    dependencies {
        testImplementation platform('org.junit:junit-bom:5.10.0')
        testImplementation 'org.junit.jupiter:junit-jupiter'
    }

    tasks.named('test') {
        useJUnitPlatform()
    }
}
```

**子模块 build.gradle**

```groovy
// common/build.gradle
dependencies {
    implementation 'com.google.guava:guava:33.0.0-jre'
}
```

```groovy
// web/build.gradle
dependencies {
    implementation project(':common')  // 依赖兄弟模块
    implementation 'org.springframework.boot:spring-boot-starter-web'
}
```

### 2.4 Gradle 生命周期和执行顺序

```
Initialization 阶段 → Configuration 阶段 → Execution 阶段
```

1. **Initialization**：解析 settings.gradle，确定哪些项目参与构建
2. **Configuration**：解析 build.gradle，生成 Task 有向无环图
3. **Execution**：按依赖顺序执行 Task

**构建钩子**

```groovy
// 每个 Task 执行前/后
gradle.taskGraph.beforeTask { task ->
    println "开始执行: ${task.name}"
}
gradle.taskGraph.afterTask { task ->
    println "完成执行: ${task.name}"
}

// 项目评估前后
project.beforeEvaluate {
    println "项目 ${it.name} 开始评估"
}
project.afterEvaluate {
    println "项目 ${it.name} 评估完成"
}
```

***

## 三、Maven vs Gradle 对比

| 对比维度 | Maven | Gradle |
|---------|-------|--------|
| **构建语言** | XML（声明式） | Groovy/Kotlin DSL（编程式） |
| **性能** | 较慢（无增量编译） | 更快（增量编译、构建缓存） |
| **灵活性** | 较低（约定优于配置） | 高（可编程配置） |
| **依赖管理** | 基于坐标的声明式 | 声明式 + 编程式 |
| **多模块支持** | 成熟稳定 | 灵活高效 |
| **构建缓存** | 无原生支持 | 内置构建缓存 |
| **增量编译** | 不支持 | 支持 |
| **学习曲线** | 较平缓 | 较陡峭 |
| **社区生态** | 非常成熟 | 快速发展 |
| **配置文件** | pom.xml | build.gradle / build.gradle.kts |

**选择建议**

| 场景 | 推荐工具 |
|------|---------|
| 企业级传统项目 | Maven（稳定性优先） |
| Android 项目 | Gradle（Android 官方支持） |
| Spring Boot 新项目 | 两者均可，Gradle 性能更优 |
| 需要高度定制构建 | Gradle |
| 团队熟悉 XML | Maven |
| 构建速度要求高 | Gradle |

***

## 四、实践项目

### 项目 1：创建 Maven 多模块项目

**目标**：创建一个包含 Web 模块和 Common 模块的多模块项目。

**步骤**：

1. 创建父 POM 项目，设置打包类型为 `pom`
2. 创建 Common 模块，包含工具类（字符串处理、日期处理）
3. 创建 Web 模块，依赖 Common 模块，提供一个 REST 接口
4. 执行 `mvn clean package` 验证构建成功

**目录结构参考**：

```
multi-module-demo/
├── pom.xml
├── common/
│   ├── pom.xml
│   └── src/main/java/com/example/common/
│       ├── StringUtils.java
│       └── DateUtils.java
└── web/
    ├── pom.xml
    └── src/main/java/com/example/web/
        └── HelloController.java
```

### 项目 2：使用 Gradle 构建 Java 项目

**目标**：使用 Gradle 构建一个简单的 Java 项目，配置依赖和任务。

**步骤**：

1. 使用 `gradle init` 初始化项目
2. 配置 Spring Boot 依赖
3. 创建一个自定义 Task 打印项目信息
4. 运行 `./gradlew build` 验证构建
