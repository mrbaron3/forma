# Contract releases

## contract-v1.0.0-rc.2

`AuthoringContextSnapshot v1`、`AuthoringAmbiguityReport v1`、著述 provenance record を追加した。
成果物は呼出し前に確定した `invocationKey` のみを保持し、provider、tool/model、profile と
input／instruction／output digest は manifest の `authorInvocationRefs` で管理する。
同期authoring portの失敗は `kind` ごとのdiscriminated unionとし、曖昧性reportと
source mutation reportを閉じた構造で公開する。

`contract-v1.0.0-rc.1` の既存 schema は変更していない。rc.2 の追加契約は additive schema として
この directory に公開する。
