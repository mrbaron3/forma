# Contract releases

## 開発中v1 namespace

2026-08-01の製品名変更（[ADR-0009](../../docs/decisions/ADR-0009-name-forma.md)）により、
`contracts/v1/`のschema namespaceは`urn:forma:schema:v1:*`とする。
固定releaseは書き換えず、`contract-v1.0.0-rc.2`以前の`urn:designflow:schema:*`を維持する。
次の固定境界は新しいRCとして公開し、旧namespaceとactive namespaceを暗黙に混在させない。

## contract-v1.0.0-rc.3

active v1 inventory全体を`urn:forma:schema:v1:*` namespaceでrelease-localに固定し、immutable revision
state contractとして`design-revision-state`、`approval-validity`、`revision-state-command`、
`revision-state-snapshot`、`revision-state-error`を追加した。revision stateはmanifestを埋め込まず、
feedback dispositionは後継revisionの`feedbackRefs`へ保持する。commandは`operation` discriminator、
snapshotはrevision／decision配列だけを公開する。

rc.1／rc.2のfileと`urn:designflow:schema:*` namespaceは変更しない。

## contract-v1.0.0-rc.2

`AuthoringContextSnapshot v1`、`AuthoringAmbiguityReport v1`、著述 provenance record を追加した。
成果物は呼出し前に確定した `invocationKey` のみを保持し、provider、tool/model、profile と
input／instruction／output digest は manifest の `authorInvocationRefs` で管理する。
`authorInvocationRefs` は `invocationKey` をkeyとする1件以上のobjectであり、同じkeyの
provenance重複をデータモデル上表現できない。
固定releaseのinventoryは `common`、`author-invocation`、`authoring-context-snapshot`、
`authoring-ambiguity-report`、`design-bundle-manifest` の5 schemaである。既存fieldを保持した
完全なmanifest schemaを収録する。

同期authoring portは `contracts/v1/` で反復する。失敗は `kind` ごとのdiscriminated union、
`deriveCapabilities` は検証対象の `experience` を明示的なinputとし、その `requestId` が
Design Requestと一致しない入力を `trace-broken` として拒否する。
snapshotの `tokenDocuments`、`components`、`patterns` は各collection内で `id` が一意、
`sourceRefs` は `ref.externalId` が一意でなければならない。JSON Schemaの構造検証に加えて
consumerはこの意味論的一意性を検証し、重複を `schema-invalid` として拒否する。

`contract-v1.0.0-rc.1` の既存 schema は変更していない。rc.2 の追加契約は additive schema として
この directory に公開する。
