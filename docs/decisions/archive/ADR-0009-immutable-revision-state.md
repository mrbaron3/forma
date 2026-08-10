# ADR-0009: revisionと人間判断をimmutable recordとして管理する

## Status

Accepted — 2026-08-03。Superseded — 2026-08-10、immutable revisionとdigest-bound decisionの現行modelは
[ADR-0012](../ADR-0012-executable-design-seed-package.md)のstage revisionが置換する。v1 contractの検証意図は
conformance vectorへ移してから既存実装を削除する（Roadmap）。

## Context

Design Requestから作るbundleはmaterial changeごとに新しいrevisionを必要とする。人間判断を可変な
状態として保存すると、判断後にmanifestが変化した際に承認対象を特定できない。またintegrator固有の
databaseやissue lifecycleを公開契約へ持ち込むことはできない。

## Decision

Formaはrevisionとdecisionを言語中立なJSON recordとして所有し、`operation` discriminatorを持つpureな
`transition(snapshot, command)`でのみ状態を進める。revision stateはmanifestを埋め込まず、
`requestId`、`revisionId`、`bundleDigest`で参照する。request-changesの採否は後継revisionの
`feedbackRefs`へ各decision 1回だけ記録し、元decisionと元revisionを変更しない。
request-changes decisionのsource revisionをsupersedeするdirect childがそのfeedback refを必ず持ち、
後続revisionへの遅延記録や重複記録は許可しない。

承認は保存状態ではなくdecisionのrequest、revision、bundle digestへの束縛から`missing`、`valid`、
`stale`を導出する。material fingerprintは著述内容だけから計算し、identity、時刻、URL、人間判断を
含めない。snapshotはrevision／decisionだけを持ち、RFC 8785で正規化する。restore時にID一意性、
lineage、request scope、decisionのrevision／digest参照、feedback参照を検証する。

pure commandは外部clockを受け取らない。revision作成時刻とsuccessorによるsupersede時刻はmanifestの
`createdAt`、decisionによる状態変更時刻はdecisionの`decidedAt`を使う。`propose`は新しい時刻sourceを
持たないため、既存の`stateChangedAt`を保持して決定論性を維持する。
RFC 3339 timestampの順序は表記文字列ではなく同一instantへ正規化して比較し、同時刻はIDのUnicode
code-point順で決める。fractionは任意精度のまま比較し、leap secondは次のUTC秒境界より前に置く。
RFC 8785境界では文字列値とobject keyのunpaired surrogateを拒否する。

永続store、transaction、repository port、process recovery、CLIはこの決定の対象外である。

## Consequences

同じrevisionId／decisionIdとcanonical-equivalentなcommandの再生は決定論的になり、material change後も
旧decisionを監査recordとして保持できる。integratorはsnapshotの保管方法を自由に選べるが、
authoritative writerを一つに限定する必要がある。
