# contract-v1.0.0-rc.2

rc.1を変更せず、authoring context、blocking ambiguity report、provenance付き完全manifestを
追加する固定release。
このdirectory内のschemaだけで新規contractの参照を解決できる。`contracts/v1/` は開発中の
参照先であり、このreleaseの配布物ではない。

固定inventoryは `common`、`author-invocation`、`authoring-context-snapshot`、
`authoring-ambiguity-report`、`design-bundle-manifest` の5 schemaである。同期
`authoring-port` は実装とともに反復中の `contracts/v1/` contractであり、この固定releaseには
含めない。

manifestの `authorInvocationRefs` は `invocationKey` をkeyとする1件以上のclosed objectである。
provenance valueはkeyを重複保持せず、同じinvocationの重複recordを構造上表現できない。

manifestのartifact pathは `/` 区切りの正規化済み相対pathである。consumerはbundle rootへ
解決した正規化pathがroot配下に残ることを確認してからfilesystemへ渡す。

snapshotの `tokenDocuments`、`components`、`patterns` は各collection内で `id` が一意、
`sourceRefs` は `ref.externalId` が一意である。JSON Schemaの `uniqueItems` だけでは
異なる内容を持つ同一IDを検出できないため、consumerは意味論的一意性も検証して重複を拒否する。
