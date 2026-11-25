# 诊断规范

## 1. 目标

每次 CLI 失败都应回答四个问题：

1. 什么失败了？
2. 在哪里或在哪个资源中失败？
3. 为什么失败？
4. 用户接下来应该做什么？

## 2. 文本格式

```txt
[ERROR] DOMAIN-001
message: unknown domain 'payment'
domain: payment
available: billing, order
suggestion: run 'boundra create-domain payment' or choose an existing domain
```

字段：

- 稳定的诊断代码
- 简洁的消息
- 零个或多个上下文字段
- 可操作的建议

边界违规维持现有 `BR-*` 文本格式，并额外遵循相同的消息/上下文/建议原则。

## 3. JSON 格式

请求 JSON 输出时，失败仍必须可被机器读取：

```json
{
  "status": "error",
  "errors": [
    {
      "code": "DOMAIN-001",
      "message": "unknown domain 'payment'",
      "context": {
        "domain": "payment",
        "available": "billing, order"
      },
      "suggestion": "run 'boundra create-domain payment' or choose an existing domain"
    }
  ],
  "meta": {
    "command": "generate"
  }
}
```

成功的 `check-boundaries` JSON 和违规字段保持向后兼容。其 `meta` 对象还会报告 `scanned_file_count` 与 `analyzed_domain_count`，使 CI 可以区分干净扫描与空扫描。领域数仅包含在 `paths.domains` 下至少有一个已扫描源文件的唯一领域；被忽略或不存在源文件的领域不计入。任一计数为零时，文本输出会发出警告；零计数本身不会改变命令退出码。

## 4. 代码类别

- `CLI-*`：命令语法和选项错误
- `PROJECT-*`：配置、manifest 和项目加载错误
- `DOMAIN-*`：领域创建和查找错误
- `DEPENDENCY-*`：领域依赖工作流错误
- `GEN-*`：生成产物和公开 API 更新错误
- `RUNTIME-*`：TypeScript 契约执行错误
- `COVERAGE-001`：未达到配置的 `--min-domains` 阈值；上下文包括 `minimum_domain_count`、`analyzed_domain_count` 和 `scanned_file_count`

## 5. 运行时验证问题

`BoundraRuntimeError` 提供标准化的 `issues`，使框架适配器与开发覆盖层不依赖特定的 Schema 提供者。

```json
{
  "name": "BoundraRuntimeError",
  "code": "RUNTIME-001",
  "contract": "create-task",
  "phase": "input",
  "message": "contract 'create-task' rejected input at 'title': 제목은 두 글자 이상 입력해 주세요.",
  "suggestion": "fix input field 'title': 제목은 두 글자 이상 입력해 주세요.",
  "issues": [
    {
      "code": "too_small",
      "path": ["title"],
      "message": "제목은 두 글자 이상 입력해 주세요."
    }
  ]
}
```

规则：

- `issues` 始终是数组；没有验证问题时为空数组。
- 每个 issue 仅稳定地暴露 `code`、`path`、`message`。
- 不序列化原始输入或 Schema 提供者的完整错误对象。
- `toJSON()` 返回以上结构，并省略内部 `cause`。
- 运行时包并不直接依赖 Zod，而是标准化结构兼容的 issue。

## 5. 退出码

- `0`：成功
- `1`：边界违规
- `2`：用法、配置、manifest 或资源验证错误
- `3`：意外的 I/O 或内部执行错误
