# Handoff

最終更新: 2026-07-31

## 現在地

ISSUE-0001として同期 `AuthoringBackend` portと決定論的mockを追加した。rc.2では
`AuthoringContextSnapshot`、`AuthoringAmbiguityReport`、manifest provenanceを公開し、schema／trace／
provenance／source mutationをrevision化前に閉じて拒否する。判断は
[ADR-0008](decisions/ADR-0008-synchronous-authoring-port.md)を正本とする。

レビュー修正では、公開artifact全体（`invocationKey` と共通形式の `ambiguities` を含む）を
field削除なしでschema検証する。不正なDesign Requestも例外ではなく `schema-invalid` に閉じ、
snapshot entry全体の変化、artifact側invocation key重複、manifestとの集合不一致、および
experience内参照切れを検出する。rc.2の新規schemaは固定release directory内で参照解決できる。
標準 `npm test` はcontract checkerとAPI testの両方を実行する。
API contract修正では、manifestにpreviewやtokenなどauthoring対象外のartifactが併存しても、
著述したartifactとprovenance recordの集合だけを過不足なく照合する。またmutation fixtureは
呼出し元のread-only snapshotを変更せず、source refの差分をexternal id単位で報告する。
current-headレビューでは、snapshot digestを内容から再計算するprovenance検証、kind別に閉じた
failure detail、`[PR-INTENT]`へ直接束縛したAPI testを追加した。1 file = 1 violationの
fixtureは期待結果付き実行ベクトルとして全件をtestから消費する。
rc.2は完全なmanifest schemaとrelease-local参照だけでcompileするtestを持つ。
`deriveCapabilities` は明示された `experience` だけをinteraction traceの入力に使う。
[#14](https://github.com/mrbaron3/designflow/issues/14)としてbundle pathをplatform-neutralな
正規化済み相対pathに限定し、consumer側のroot内resolve確認も公開contract文書へ固定した。

製品名・repository名を`Designflow`／`designflow`へ統一した。Phase 0 Contract bootstrapは完了し、
公開contract draft、North Star、設計原則、architecture、roadmap、ADR、contract検証scriptがある。
remoteはprivateの`https://github.com/mrbaron3/designflow`、現在の固定境界は
`contract-v1.0.0-rc.2`（rc.1は不変）。
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

1. `contract-v1.0.0-rc.2`の追加契約と`npm test`を確認する。
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
