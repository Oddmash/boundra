# 领域 Manifest 规范

## 1. 文件位置

```txt
<configured-domains-path>/[<group>/]<domain>/<configured-manifest-file>
```

Boundra 会在 `paths.domains` 下递归查找配置指定的 manifest 文件名。manifest 的父目录是领域的物理根目录，而 `name` 是稳定的逻辑身份标识。

## 2. 用途

`domain.json` 是领域公开 API 和声明的领域依赖的唯一事实来源。

以下功能使用该文件：

- `check-boundaries`
- `graph-domains`
- `generate route|query|mutation`
- `add-dependency`
- BR-004 公开 API 验证
- BR-006 声明依赖验证

## 3. Schema 结构

```json
{
  "$schema": "https://boundra.dev/schemas/domain-manifest.v1.json",
  "name": "billing",
  "version": "0.1.0",
  "publicApi": {
    "client": ["./client/public.ts"],
    "server": ["./server/public.ts"],
    "shared": [
      "./shared/public.ts",
      "./shared/contracts/create-invoice.ts"
    ]
  },
  "dependsOn": ["order"],
  "policies": {
    "allowCrossDomainServerImport": false,
    "allowMcpWrite": false
  }
}
```

## 4. 当前加载的字段

当前 CLI 加载并验证以下字段：

- `name`
- `publicApi.client`
- `publicApi.server`
- `publicApi.shared`
- `dependsOn`

其他字段可以存在，并在可能的情况下保留，但尚不强制执行。

## 5. 验证规则

- `name` 必须与领域目录名一致。
- 不同根目录之间重复的 `name` 无效。
- `dependsOn` 的条目必须引用已有领域。
- `dependsOn` 必须构成无环图。
- 公开 API 路径必须为相对路径。
- 公开 API 路径必须指向已有文件。
- 公开 API 路径不得暴露 `internal` 路径。
- 不包含配置指定 manifest 文件的目录仅用于组织，不会作为领域加载。

## 6. 代码生成行为

`generate route|query|mutation <domain>/<name>` 创建共享契约文件：

```txt
domains/<domain>/shared/contracts/<name>.ts
```

生成后，CLI 会将契约追加至：

```json
{
  "publicApi": {
    "shared": ["./shared/contracts/<name>.ts"]
  }
}
```

保留现有的 `publicApi.shared` 条目，不会添加重复条目。

生成还会向 `shared/public.ts` 追加幂等的 export。

## 7. 紧凑单层领域

恰好一个公开 API 分类非空的领域可以在领域根目录下保存直属实现文件：

```txt
domains/comparison/
├── domain.json
├── public.ts
├── storage.ts
└── tests/
    └── storage.spec.ts
```

```json
{
  "publicApi": {
    "client": ["./public.ts"],
    "server": [],
    "shared": []
  }
}
```

直属根目录的文件继承该唯一分层以执行边界规则。显式分层目录保留正常含义，根目录下的嵌套目录不继承紧凑分层。暴露两个或更多公开 API 分类的领域必须使用显式分层目录。

## 8. 依赖更新行为

`add-dependency <domain>/<dependency>` 将依赖追加至 `dependsOn`。两个领域都必须存在，且拒绝自依赖，重复调用不会添加重复项。会导致依赖循环的边将被拒绝，且不修改 manifest。

## 9. 版本控制

初始 Schema 版本：

```txt
v1
```

Schema 变更应优先考虑增量扩展。破坏性变更需要 ADR。
