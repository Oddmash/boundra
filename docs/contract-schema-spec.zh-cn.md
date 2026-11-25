# 契约 Schema 规范

## 1. 唯一事实来源

`domains/<domain>/shared/contracts/` 中的每个生成契约文件拥有两个运行时 Schema：

- 输入 Schema
- 结果 Schema

TypeScript 输入与结果类型均由这些 Schema 推断，不另行生成手写接口。

## 2. Schema 提供者

初始生成器生成 Zod Schema。`boundra` 仅要求以下结构，因此不依赖于特定 Schema 提供者：

```ts
export type BoundraSchema<Output> = {
  parse(value: unknown): Output;
};
```

当其他 Schema 提供者的 Schema 实现相同的 parse 契约时，也可使用该提供者。提供者特有的功能不属于 Boundra 运行时 API。

## 3. 契约结构

```ts
import { defineQuery, type InferSchema } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({});
export const getOrderResultSchema = z.object({});

export type GetOrderQueryInput = InferSchema<typeof getOrderInputSchema>;
export type GetOrderQueryResult = InferSchema<typeof getOrderResultSchema>;

export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

生成的空对象是安全的脚手架。功能开发时将其字段替换为真实领域 Schema；文件生成后归应用所有，绝不会被覆盖。

## 4. 运行时行为

- 客户端 query/mutation 调用在传输前解析输入
- 传输结果在返回应用代码之前进行解析
- 客户端调用可以传入 `AbortSignal`，信号会被转发给自定义传输与 HTTP 传输
- 主动取消会原样重新抛出，而不是作为 `RUNTIME-003` 传输失败报告
- 服务端执行 route 时先解析处理器输入，再在返回前解析处理器结果
- 缺少处理器和 Schema 解析失败会产生类型化的运行时错误
- Schema 解析失败通过 `BoundraRuntimeError.issues` 暴露与提供者无关的字段问题
- 序列化的运行时错误省略原始输入和内部 `cause`

## 5. 公开导出

生成器向 `shared/public.ts` 追加幂等的 export：

```ts
export * from "./contracts/get-order";
```

为了与当前 manifest 兼容，直接契约路径仍保留在 `domain.json` 的 `publicApi.shared` 中。使用方应优先选择稳定的 `shared/public` 入口。

生成 query、mutation 和 resource 时，还会幂等地将对应适配器追加至 `client/public.ts`。如果已有等价导出，仅引号不同、未使用分号或带有尾随注释，不会重复添加。现有应用导出仍保留：

```ts
export * from "./queries/get-order";
```

生成 route 不会添加客户端导出。

## 6. 所有权

- 生成器负责初始文件创建
- 之后由应用代码负责 Schema 字段和处理器实现
- 再次生成必须失败，而不是覆盖应用的变更
