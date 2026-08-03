# Forma

ユーザー体験を、実装前に設計・検証・人間承認できる独立ツール。

このリポジトリは、画面の見た目だけではなく次を1つの版固定されたDesign Bundleとして扱う。

- Page Purposeと成功状態
- 目的達成までのEffort Budget
- Attention Hierarchy
- User Flow、画面状態、要素と配置の理由
- Design Token／Component／Patternの再利用・拡張差分
- UI操作から導出したBackend Capability Requirement
- 人間が確認できるPreviewと、revision digestへ束縛されたDesign Decision

## 現在地

**Bootstrap / contract-first段階。** ランタイムは未実装。公開契約、設計原則、境界、ロードマップ、
引き継ぎ地点を先に固定している。

## 独立性

特定consumerの型、Store、状態機械、agent runtime、worktreeへ依存しない。連携はversion付きJSON契約、
content-addressed Design Bundle、CLIまたはHTTPだけを通す。consumer固有adapterやconsumerの実装taskは
このリポジトリで所有しない。

## 読む順番

1. [North Star](docs/NORTH_STAR.md)
2. [設計原則](docs/PRINCIPLES.md)
3. [アーキテクチャ](docs/ARCHITECTURE.md)
4. [実行計画](docs/ROADMAP.md)
5. [現在の引き継ぎ地点](docs/HANDOFF.md)
6. [契約v1](contracts/v1/README.md)

## 検証

```bash
npm install
npm test
```

`npm test`は全JSON Schemaのcompile、example validation、要求・目的・task・region・element・
capability間の参照整合を検査する。

## リポジトリ状態

正式名称は`Forma`、public repositoryは
[`mrbaron3/forma`](https://github.com/mrbaron3/forma)。公開contractとForma自身のtaskだけを
所有する。consumer固有taskは置かない。
