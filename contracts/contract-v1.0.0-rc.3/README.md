# contract-v1.0.0-rc.3

active v1 inventoryとimmutable revision state contractを凍結した固定releaseである。全schema IDと
参照は`urn:forma:schema:v1` namespaceを使い、このdirectory内だけで解決できる。rc.1／rc.2は
変更しない。

このdirectoryがconsumerとのPublished Languageの正本である。runtime実装の型はここへconformし、
別製品の内部型を公開contractへ追加しない。

## Schemas

| Schema | Responsibility |
|---|---|
| `design-request.schema.json` | product intent、requirements、constraints、target surface |
| `experience-contract.schema.json` | purpose、task、flow、effort、attention、region、element |
| `design-system-delta.schema.json` | reuse／extend／create判断とtoken／component／pattern差分 |
| `capability-requirements.schema.json` | interactionから導出したbackend能力要求 |
| `design-bundle-manifest.schema.json` | immutable revisionのartifact一覧とdigest |
| `human-design-decision.schema.json` | revision digestへ束縛された人間判断 |
| `design-revision-state.schema.json` | immutable revisionのlifecycle stateとfeedback disposition参照 |
| `approval-validity.schema.json` | approvalのmissing／valid／stale導出結果 |
| `revision-state-command.schema.json` | pure revision state transitionのclosed command union |
| `revision-state-snapshot.schema.json` | revision／decision監査履歴のcanonical snapshot |
| `revision-state-error.schema.json` | no-write failureのclosed error record |
| `authoring-context-snapshot.schema.json` | read-onlyな著述context snapshot |
| `authoring-ambiguity-report.schema.json` | blocking ambiguityの構造化report |
| `author-invocation.schema.json` | manifestのinvocationKey keyed mapに置く著述provenance value |
| `authoring-port.schema.json` | 同期著述operationのinput／success／kind別failure |

## Versioning

- `schemaVersion`のmajor変更は互換性を壊す。
- additive optional fieldは同major内で許可する。
- enum追加はconsumerがunknown valueをfail closedするため、minor変更としてrelease noteを必要とする。
- field削除、意味変更、required追加は新major。
- Design Bundleは自身が参照する全schema IDをmanifestへ記録する。

## Bundle digest

正確なbytesとSHA-256計算は[CANONICALIZATION.md](CANONICALIZATION.md)を正本とする。
`examples/`のdigest値はconsumerがruntime非依存に検証する規範fixtureである。

## Artifact path

`artifactRef.path` とtoken documentの `path` は `/` 区切りの正規化済み相対pathである。
consumerはbundle rootへ解決した正規化pathがroot配下に残ることを確認してからfilesystemへ
渡す。platform固有のseparator、absolute path、`.`／`..` segmentは受理しない。

## Examples

`examples/`は1つのDashboard設計revisionを構成する。`npm test`は各schemaだけでなく、ファイル間の
requirement、purpose、task、flow step、region、element、capability参照を検査する。
