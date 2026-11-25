# エラービュー

Boundra は `boundra/ui` からフレームワークに依存しない単一のブラウザーエラービューを提供します。正規化された診断のみを表示し、契約の入力、結果、スキーマプロバイダーのエラー、cause を読み取ることはありません。

## Vite

Vite アプリケーションでは通常、プラグインだけが必要です。

```ts
import { boundra } from "boundra/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boundra()],
});
```

`vite serve` の実行中、Boundra はビューをインストールし、未処理の `BoundraRuntimeError` の値を取得し、CLI からの境界診断を公開します。プロダクションビルドには注入されません。

## Next.js とその他のブラウザーホスト

Next.js は Vite プラグインを実行しません。Client Component からビューをインストールし、正規化された Boundra エラーを明示的に渡してください。

```tsx
"use client";

import { useEffect } from "react";
import { createBoundraErrorView } from "boundra/ui";
import type { BoundraRuntimeErrorJson } from "boundra";

export const BoundraErrorView = ({
  error,
}: {
  error?: BoundraRuntimeErrorJson;
}) => {
  useEffect(() => {
    if (!error || process.env.NODE_ENV === "production") return;

    const view = createBoundraErrorView();
    view.reportRuntime(error);
    return () => view.dispose();
  }, [error]);

  return null;
};
```

サーバー・クライアント境界を越える前に `error.toJSON()` を使用してください。元のエラー、cause、リクエスト、レスポンス、入力、結果をブラウザーへ送らないでください。

## 処理済みのブラウザーエラー

未処理のブラウザーエラーが自動的に取得されるのは Vite アダプターだけです。処理済みのエラーの場合は、ビューのインスタンスを1つ維持して直接報告します。

```ts
import { BoundraRuntimeError } from "boundra";
import { createBoundraErrorView } from "boundra/ui";

const view = createBoundraErrorView();

try {
  await loadProjects();
} catch (error) {
  if (error instanceof BoundraRuntimeError) {
    view.reportRuntime(error.toJSON());
  }
}
```

返されるコントローラーは次をサポートします。

- `reportRuntime(error)` でランタイム診断を置き換えます。
- `reportBoundary(payload)` で境界診断を置き換えます。
- `clear("runtime" | "boundary")` で一方のソースを消去します。
- `dispose()` でビューを削除し、イベントハンドラーを解放します。

境界診断からエディターへの移動はオプションです。Vite は自動設定します。他のホストではビュー作成時に `openInEditor(location)` を渡すことができます。
