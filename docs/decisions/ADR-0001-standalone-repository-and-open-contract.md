# ADR-0001: 独立repositoryと公開contractでconsumerから分離する

- 状態: 採択
- 日付: 2026-07-25

## 文脈

開発基盤内へUI Design Artifactを実装すると、その基盤のIntake、Issue、Store、Agent Runtimeへ
結合しやすい。Experience Design、Design System Governance、Human Reviewは複数の開発基盤、
単体CLI、既存製品のdesign auditでも利用できる能力である。

## 決定

- Designflowを独立repositoryとして所有する。
- consumer固有型を公開domainへ持ち込まない。
- 公開境界をversion付きJSON Schema、Design Bundle、CLI／HTTP portとする。
- engineとconsumerはDBを共有しない。
- consumerはexternal referenceとdigestだけを投影する。

## 帰結

- 独立したrelease cadenceとsecond consumer検証が可能になる。
- schema versioning、adapter、cross-repository contract testが必要になる。
- 初期実装量は増えるが、consumer内部型への偶発的結合を避けられる。
