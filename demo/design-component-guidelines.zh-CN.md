# 设计组件规范

> 本文档基于当前项目代码整理，用于说明系统现有设计组件、样式变量与页面开发约定。最后整理日期：2026-06-15。

## 1. 技术与组件基础

- 前端技术栈：Vue 3、Vite、TypeScript、Element Plus、UnoCSS、SCSS。
- Element Plus 版本：`2.9.1`，是项目基础 UI 组件库。
- 自定义组件主要位于 `src/components`。
- 布局组件主要位于 `src/layout/components`。
- 全局样式主要位于 `src/styles`。
- 主题、尺寸、暗色模式、布局状态由 `src/store/modules/app.ts` 统一管理。

## 2. 设计规范相关源码

| 类型 | 位置 | 说明 |
| --- | --- | --- |
| 全局样式入口 | `src/styles/index.scss` | 引入变量、主题、FormCreate 样式，并覆盖按钮、单选、表格悬停、消息确认框等样式 |
| CSS 变量 | `src/styles/var.css` | 定义菜单、头部、内容区、过渡时间等全局变量 |
| SCSS 命名空间 | `src/styles/variables.scss` | 定义项目命名空间 `$namespace: v` 与 Element Plus 命名空间 `$elNamespace: el` |
| SCSS 模块变量 | `src/styles/global.module.scss` | 暴露 `namespace`、`elNamespace` 给 `useDesign` 使用 |
| 主题状态 | `src/store/modules/app.ts` | 管理主题色、布局、暗色模式、组件尺寸、菜单折叠等 |
| UnoCSS 配置 | `uno.config.ts` | 定义 `custom-hover`、布局边框、`wh-full` 等原子类与快捷类 |
| Element Plus 注册 | `src/plugins/elementPlus/index.ts` | 注册 `ElLoading`、`ElScrollbar`、`ElButton` |
| 全局组件注册 | `src/components/index.ts` | 全局注册 `Icon`、`FormTable` |
| 国际化 | `src/locales/zh-CN.ts`、`src/locales/ja.ts`、`src/locales/en.ts` | 多语言文案来源 |

## 3. 命名与样式约定

项目使用 `useDesign` 生成组件级 class 前缀：

```ts
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('content-wrap')
```

默认生成格式为：

```text
v-content-wrap
```

新增公共组件时建议继续使用该方式，避免命名冲突，并保持组件样式可追溯。

## 4. 主题与颜色规范

当前项目主题色在 `src/store/modules/app.ts` 中定义：

| 用途 | 当前值 |
| --- | --- |
| 主色 `elColorPrimary` | `#175CD3` |
| 危险色 `--el-color-danger` | `#e31b54` |
| 页面背景 `--app-content-bg-color` | `#fafafa` |
| 左侧菜单背景 | `#fff` |
| 头部背景 | `#fff` |
| 主要悬停蓝色 | `#357af2` |
| 主要按下蓝色 | `#0f51c5` |
| 禁用灰色 | `#d5d7da` |

主题色会通过 `setCssVarTheme()` 写入 CSS 变量，并通过 `setPrimaryLight()` 生成 Element Plus 主色浅色变量，例如：

- `--el-color-primary-light-3`
- `--el-color-primary-light-5`
- `--el-color-primary-light-7`
- `--el-color-primary-light-8`
- `--el-color-primary-light-9`
- `--el-color-primary-dark-2`

开发新页面时应优先使用 CSS 变量，例如：

```scss
color: var(--el-color-primary);
background: var(--app-content-bg-color);
transition: all var(--transition-time-02);
```

## 5. 布局规范

系统支持多种后台布局，渲染逻辑位于 `src/layout/components/useRenderLayout.tsx`：

- `left`：当前默认布局，顶部工具栏 + 左侧可折叠菜单。
- `classic`：经典左侧菜单布局。
- `topLeft`：顶部工具栏 + 左侧菜单。
- `top`：顶部菜单布局。
- `cutMenu`：分栏菜单布局。

常用布局变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `--left-menu-max-width` | `200px` | 左侧菜单展开宽度 |
| `--left-menu-min-width` | `64px` | 左侧菜单折叠宽度 |
| `--logo-height` | `48px` | Logo 与顶部工具栏高度 |
| `--top-tool-height` | `var(--logo-height)` | 顶部工具栏高度 |
| `--tags-view-height` | `32px` | 标签页高度 |
| `--app-content-padding` | `0` | 内容区内边距 |
| `--transition-time-02` | `0.2s` | 通用过渡时间 |

页面内容区域建议使用已有布局组件承载，不建议在业务页面中重复实现整体框架。

## 6. UnoCSS 使用约定

项目启用 UnoCSS，配置位于 `uno.config.ts`。

已有快捷类：

- `wh-full`：等价于 `w-full h-full`。

已有自定义规则：

- `custom-hover`：用于头部、Logo、工具栏等悬停区域。
- `layout-border__left`
- `layout-border__right`
- `layout-border__top`
- `layout-border__bottom`

建议：

- 布局间距、flex、宽高等优先使用已有原子类。
- 边框和悬停状态优先使用已有自定义规则。
- 复杂样式放入组件 scoped SCSS 或全局样式文件。

## 7. 国际化规范

当前项目包含中文、日语、英文语言文件：

- `src/locales/zh-CN.ts`
- `src/locales/ja.ts`
- `src/locales/en.ts`

组件内通过 `useI18n()` 获取 `t`：

```ts
const { t } = useI18n()
```

建议：

- 页面标题、按钮、提示、校验信息应优先写入语言文件。
- 已有公共文案应复用 `common` 下的 key，例如 `common.query`、`common.reset`、`common.back`。
- 新增中日双语页面时，应同步维护 `zh-CN.ts` 与 `ja.ts`。

## 8. 页面开发建议

新增后台页面时建议遵循以下结构：

1. 使用 `ContentWrap` 承载页面主区域。
2. 查询区使用 `Search`。
3. 表格使用 `Table` 或 `ElTable` + `Pagination`。
4. 新增、编辑、详情弹窗使用 `Dialog`。
5. 表单使用 `Form` + `schema`。
6. 图标使用全局 `Icon`。
7. 颜色使用 CSS 变量，不直接散落硬编码颜色。
8. 文案走国际化。
9. 业务复杂页面可以使用领域组件，例如 `Annotation`、`Recognize`、`FilePreview`、`UploadFile` 等。

## 9. 业务组件分布

项目中除基础组件外，还包含较多业务组件：

| 类型 | 示例位置 | 说明 |
| --- | --- | --- |
| 标注相关 | `src/components/Annotation` | 票据/图像标注能力 |
| 识别相关 | `src/components/Recognize` | 识别结果与操作组件 |
| 文件预览 | `src/components/FilePreview`、`src/components/vueOfficePreview` | PDF、图片、Office 预览 |
| 上传 | `src/components/UploadFile` | 文件、图片、标注文件上传 |
| 表单设计 | `src/components/FormCreate` | 动态表单设计相关 |
| 可视化 | `src/components/Echart` | 图表封装 |
| 页面装修 | `src/components/DiyEditor`、`src/components/MagicCubeEditor` | 移动端页面装修组件 |

使用业务组件前建议先阅读对应组件目录下的 `index.vue`、`config.ts`、`data.js` 或 hooks 文件，确认数据结构与事件契约。



