# Contract releases

## contract-v1.0.0-rc.2

`AuthoringContextSnapshot v1`、`AuthoringAmbiguityReport v1`、著述 provenance record を追加した。
成果物は呼出し前に確定した `invocationKey` のみを保持し、provider、tool/model、profile と
input／instruction／output digest は manifest の `authorInvocationRefs` で管理する。
固定releaseのinventoryは `common`、`author-invocation`、`authoring-context-snapshot`、
`authoring-ambiguity-report`、`design-bundle-manifest` の5 schemaである。既存fieldを保持した
完全なmanifest schemaを収録する。

同期authoring portは `contracts/v1/` で反復する。失敗は `kind` ごとのdiscriminated union、
`deriveCapabilities` は検証対象の `experience` を明示的なinputとする。

`contract-v1.0.0-rc.1` の既存 schema は変更していない。rc.2 の追加契約は additive schema として
この directory に公開する。
