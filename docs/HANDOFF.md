# Handoff

最終更新: 2026-07-30

## 現在地

製品名・repository名を`Designflow`／`designflow`へ統一した。Phase 0 Contract bootstrapは完了し、
公開contract draft、North Star、設計原則、architecture、roadmap、ADR、contract検証scriptがある。
remoteはprivateの`https://github.com/mrbaron3/designflow`、固定境界は`contract-v1.0.0-rc.1`。
tracking Epicは[#1](https://github.com/mrbaron3/designflow/issues/1)。

2026-07-30、利用想定をhero scenarioとして固定した
（[ADR-0005](decisions/ADR-0005-hero-scenario-mock-first-preview.md)、
[#11](https://github.com/mrbaron3/designflow/issues/11)）: 新サービス基盤の一括設計・人間は承認者・
モック先行preview。優先経路はDF-006→DF-007→preview renderer（受け皿DF-004／DF-005）、
conformance（DF-009）は将来scope。

このrepositoryはDesignflow自身のtaskだけを所有する。特定consumerのadapter、Issue、API設計、
Dashboard実装を待たず、固定contract releaseに対して単独で進める。

## 確定した判断

- integrationはJSON contract／content-addressed bundle／CLIまたはHTTPだけを通す。
- Purpose–Effort–Visibilityと全element／placementの理由traceを設計上位契約とする。
- UXはBackend Capability Requirementを著述し、具体API設計はconsumer側へ残す。
- Human Design Decisionをrevision digestへ束縛する。
- DB共有、dual-write、cross-repository Issue dependencyを禁止する。
- `ExperienceContract`はartifact名、`Designflow`は製品名とする。
- hero scenarioは一括基盤設計＋モック先行preview。governance artifactはrequiredを維持したまま
  authoring agentが全量著述し、人間へ著述コストを求めない（ADR-0005）。

## 再開点

1. `contract-v1.0.0-rc.1`の存在と`npm test`を確認する。
2. `docs/ROADMAP.md`の独立task DAGを読む。
3. DF-002、DF-004、DF-006から最大3件を並行着手する。
4. consumer固有要求を見つけた場合、このrepositoryへ実装せず公開contractで表現可能かだけを判断する。

## 再開時の確認

```bash
git status --short --branch
git remote -v
npm install
npm test
```

読む順:

1. `docs/NORTH_STAR.md`
2. `docs/PRINCIPLES.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ROADMAP.md`
5. `docs/decisions/`
6. `contracts/v1/`

## 意図的に未着手

- production runtime
- agent provider integration
- Review UI
- DB選定
- consumer adapter
- consumer product dogfood

これらのうちconsumer側の項目はDesignflowのblockerではない。
