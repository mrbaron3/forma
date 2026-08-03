# ADR-0009: revisionと人間判断をimmutable recordとして管理する

## Status

Accepted — 2026-08-03

## Context

Design Requestから作るbundleはmaterial changeごとに新しいrevisionを必要とする。人間判断を可変な
状態として保存すると、判断後にmanifestが変化した際に承認対象を特定できない。またintegrator固有の
databaseやissue lifecycleを公開契約へ持ち込むことはできない。

## Decision

Designflowはrevision、decision、feedback dispositionを言語中立なJSON recordとして所有し、pureな
`transition(snapshot, command)`でのみ状態を進める。承認は保存状態ではなくdecisionのrequest、revision、
bundle digestへの束縛から`missing`、`valid`、`stale`を導出する。material fingerprintは著述内容だけから
計算し、identity、時刻、URL、人間判断を含めない。snapshotはRFC 8785で正規化し、restore時にlineageと
参照整合性を検証する。

永続store、transaction、repository port、process recovery、CLIはこの決定の対象外である。

## Consequences

同じcommandの再生は決定論的になり、material change後も旧decisionを監査recordとして保持できる。
integratorはsnapshotの保管方法を自由に選べるが、authoritative writerを一つに限定する必要がある。
