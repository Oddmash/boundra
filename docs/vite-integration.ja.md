# Vite 連携

```ts
import react from "@vitejs/plugin-react";
import { boundra } from "boundra/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boundra(), react()],
});
```

開発中、プラグインは次の処理を行います。

- 未処理の `BoundraRuntimeError` の詳細をブラウザーのオーバーレイに表示します。
- 契約、フェーズ、コード、フィールドパスとともに正規化されたすべての検証の問題を表示します。
- 起動時とソースまたは JSON/JSONC メタデータ更新後に非同期で境界検査を実行し、連続保存をまとめて古い結果を破棄します。
- ファイル・行の位置と import とともに、すべての境界違反を表示します。
- 入力、結果、cause の値を含めず、イシュー報告用の安全なテキスト要約をコピーします。
- ランタイムと境界の状態を独立させ、境界スキャンが正常でも有効なランタイムエラーを隠さないようにします。
- TypeScript、JavaScript、Svelte のソース更新に反応します。
- 解決済みの境界診断を自動で消去します。ランタイム診断は閉じるボタンまたは `Escape` で閉じることができます。
- 検査を実行できない場合はオーバーレイを消去せず、構造化された診断コードと復旧の提案を含む CLI・プロジェクトのエラーを表示します。

オーバーレイはプロダクションビルドには注入されません。ネイティブ CLI が npm ランチャーを通じて解決されない場合の、管理された開発環境またはテストでのみ `cliPath` を使用してください。

レンダラー自体はフレームワークに依存せず、`boundra/ui` に配置されています。処理済みエラーと Next.js 連携については [`error-view.md`](./error-view.md) を参照してください。
