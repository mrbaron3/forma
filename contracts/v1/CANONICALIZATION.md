# Canonicalization and digest v1

この文書は`contract-v1.0.0-rc.1`のdigest計算を固定する。実装言語に関係なく同じbytesとSHA-256を得る。

## JSON artifact

JSON artifactは[RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)へ
適合するUTF-8 bytesへcanonicalizeしてからSHA-256を計算する。

```text
digest = "sha256:" + lowercase_hex(SHA-256(canonical_json_utf8))
```

- object memberはUTF-16 code unit順
- array順序は保持
- whitespaceは出力しない
- string／number serializationはRFC 8785に従う
- duplicate member、non-finite number、invalid Unicodeは入力拒否

`application/json`と`+json` media typeへこの規則を適用する。

## Non-JSON artifact

HTML、画像等は保存されたraw bytesへSHA-256を計算する。改行やencodingの正規化を行わない。

## Source digest

`sourceDigest`はDesign Request JSON全体のcanonical JSON digestである。`sourceRef.digest`は外部source
snapshotのdigestであり、`sourceDigest`とは別物である。

## Artifact digest

manifestの各`artifacts.<key>.digest`は上記media type規則で対象fileから計算する。
Design System Delta内の`tokenDocuments[].digest`にも同じJSON規則を適用する。

## Bundle digest

1. Design Bundle Manifestを読み込む。
2. top-levelの`bundleDigest` memberだけを除く。
3. 残りのmanifest全体をRFC 8785でcanonicalizeする。
4. SHA-256を計算し、`sha256:<lowercase hex>`として`bundleDigest`へ格納する。

Human Design Decisionはbundleの外部判断なのでbundle digest入力に含めない。Decision自身が同じ
`requestId`、`revisionId`、`bundleDigest`を参照する。

## Conformance fixture

`examples/`のdigest値は規範fixtureである。consumerはDesignflow runtimeを起動せず、同じ値を再計算できなければ
ならない。`npm test`はsource、全artifact、token document、bundle、Human Decisionのdigest整合を検証する。
