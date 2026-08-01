# ADR-0009: 製品名とrepository名をFormaへ変更する

- 状態: 採択
- 日付: 2026-08-01
- 置換対象: [ADR-0004](ADR-0004-name-designflow.md)

## 文脈

`Designflow`は製品の責務を表す一方、日常的なCLI入力やrepository名として長い。
内部利用する独立製品として、短く入力しやすい名称へ揃える。

`Forma`はAutodeskの設計製品群でも使用されている名称だが、本製品は外部公開サービスとして
展開しない。名称の一意性より、内部での入力しやすさと識別の簡潔さを優先する。

## 決定

- 製品名を`Forma`、repository、package、CLI名を`forma`とする。
- 開発中の公開schema namespaceを`urn:forma:schema:*`とする。
- 固定releaseはimmutable artifactとして扱う。`contract-v1.0.0-rc.2`以前の
  `urn:designflow:schema:*`は変更せず、次の固定releaseは新しいRCとして公開する。
- 既存の`DF-NNN` task keyは履歴参照を壊さないため維持し、新規taskには`FM-NNN`を使う。
- 既存ADRは当時の判断記録として名称やURLを書き換えない。

## 帰結

- 現行実装、example、文書、repository URL、ローカルdirectoryは`forma`へ揃う。
- active schemaを参照するconsumerは`urn:forma:schema:*`へ切り替える必要がある。
- 固定releaseの旧namespaceとactive namespaceを同一bundle内で暗黙に混在させない。
- 将来外部公開へ方針転換する場合、既存製品との名称衝突を再評価する。
