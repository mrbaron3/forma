# Roadmap

## 進め方

契約→決定論core→人間review→authoring→配布→conformanceの順で進める。Designflowはconsumerの
adapter、Issue、API設計、dogfood実装を所有しない。外部consumerは固定されたcontract releaseとfixtureだけを
入力にして、Designflowの実装完了を待たずに並行開発できる。

力点はhero scenario（新サービス基盤の一括設計とモック先行preview —
[ADR-0005](decisions/ADR-0005-hero-scenario-mock-first-preview.md)）に置き、
DF-006→DF-007→preview renderer（受け皿はDF-004／DF-005）を優先経路とする。
conformance（DF-009／Phase 5）は将来scopeとしてroadmapに残すが、v0完了条件に含めない。

## 並行開発境界

- 公開境界: `contracts/v1`、example bundle、negative fixture、contract release tag
- Designflowが所有: bundle生成・revision・preview・decision・authoring・conformance
- consumerが所有: contract取得、adapter、product planning、API、Issue、実装、release
- 禁止: cross-repository Issue dependency、共有DB、内部型import、相手repositoryへの書込み
- 互換性確認: 各repositoryが同じtagのfixtureを独立実行し、統合時はblack-box conformanceだけを行う

最初の固定境界は`contract-v1.0.0-rc.1`とする。RC内のbreaking changeは新しいRC tagで公開し、
既存tagを書き換えない。

## Phase 0 — Contract bootstrap

目的: 別team／別言語が同じ意味で実装できる境界を固定する。

- [x] standalone repository
- [x] 名称をDesignflowへ統一
- [x] North Star／Purpose–Effort–Visibility
- [x] bounded contextsとstate ownership
- [x] Design Request／Experience／Design System Delta／Capability／Bundle／Decision schema v1 draft
- [x] valid exampleとcross-artifact integrity check
- [x] ADR-0001..0004
- [x] canonicalizationとdigest fixture
- [x] `contract-v1.0.0-rc.1` tagを公開

Exit:

- `npm test`がgreen
- consumer固有型をimportせずexample bundleを検証可能
- immutable contract RCをremoteから取得可能

## Phase 1 — Deterministic revision core

目的: agentなしでrequest→revision→decision→approved bundleが成立する。

- Request validation
- artifact reference integrity
- canonical serialization／SHA-256 digest
- immutable revision state machine
- approval invalidation
- local repository store
- CLI import／status／decide／export

Exit:

- process restart後も同じrevision／decisionを復元
- bundle変更で旧approvalがstale
- file modeだけで一巡可能

## Phase 2 — Human review surface

目的: raw JSONを開かず設計を理解・比較・判断できる。

- purpose／flow／effort／attention view
- 視覚モックとして成立するsafe HTML preview（annotated wireframeは補助表示であり、単独ではexitを満たさない）
- token／component／pattern delta
- capability requirements
- requirement trace
- revision diff
- approve／request-changes／reject

Exit:

- reviewerがモックpreviewを第一確認面として「どのようなデザインになるか」を判断できる
- reviewerが1画面から判断根拠と変更差分を確認
- decisionがrevision digestへ束縛
- keyboard／focus／status announcementを含むWCAG 2.2 AA相当のreview UI

## Phase 3 — Authoring adapters

目的: provider非依存にExperience／Design System／Capability artifactを生成する。

- `AuthoringBackend` port
- Experience Author persona
- Design System Steward persona
- ambiguity／revision feedback loop
- read-only context snapshot
- output schema／provenance validation

Exit:

- mock backendと少なくとも1 real providerで同じcontractを満たす
- malformed／misrouted／source-mutating authoringをfail closed

## Phase 4 — Distribution and black-box API

目的: consumerを知らずにCLI／HTTPの同じ意味論を提供する。

- versioned CLI
- OpenAPI service contract
- local file mode
- status／bundle export
- health／readiness
- conformance fixture distribution

Exit:

- CLIとHTTPが同じrequest/revision/digest/decision semanticsを持つ
- consumer repositoryなしでE2Eを実行可能
- packageまたはrelease artifactからcontractとfixtureを取得可能

## Phase 5 — Conformance and reuse（将来scope — v0完了条件に含めない）

目的: 設計を作って終わらず、任意の実装をApproved Bundleへ照合できる。hero scenario（ADR-0005）の
確定により本Phaseはv0の力点から外すが、North Starの価値としてroadmapに保持する。

- token resolver／drift lint
- component／state coverage
- browser state evidence input
- visual evidence input
- accessibility evidence input
- capability contract evidence input

Exit:

- implementation driftを理由付きで検出
- 固有consumerのlifecycleをimportせずconformance reportを生成

## 独立task DAG

```text
contract-v1.0.0-rc.1（DF-001 canonical digest完了）
  ├─ DF-002 revision state ─────▶ DF-003 local store / CLI
  ├─ DF-004 review projection ─▶ DF-005 human decision UI
  └─ DF-006 authoring port ─────▶ DF-007 provider adapters

DF-003 + DF-005 ─▶ DF-008 distribution API
DF-003 + DF-004 ─▶ DF-009 conformance
```

DF-002、DF-004、DF-006は同時着手できる。

| Key | Issue | Work | Depends on | Completion evidence |
|---|---|---|---|---|
| DF-001 | 完了 | Canonical bundle digest | contract draft | source/artifact/token/bundle fixture検証 |
| DF-002 | [#8](https://github.com/mrbaron3/designflow/issues/8) | Revision／decision state machine | DF-001 | stale approval／supersede test |
| DF-003 | [#3](https://github.com/mrbaron3/designflow/issues/3) | Local repository and CLI | DF-002 | restart recovery E2E |
| DF-004 | [#9](https://github.com/mrbaron3/designflow/issues/9) | Review projection | contract RC | purpose／effort／attention／trace表示 |
| DF-005 | [#2](https://github.com/mrbaron3/designflow/issues/2) | Human decision UI | DF-004 | request-changes→new revision→approve |
| DF-006 | [#4](https://github.com/mrbaron3/designflow/issues/4) | AuthoringBackend port | contract RC | mock backend contract test |
| DF-007 | [#5](https://github.com/mrbaron3/designflow/issues/5) | Provider adapters | DF-006 | malformed／mutation fail-closed |
| DF-008 | [#6](https://github.com/mrbaron3/designflow/issues/6) | CLI／HTTP distribution | DF-003, DF-005 | black-box parity E2E |
| DF-009 | [#7](https://github.com/mrbaron3/designflow/issues/7) | Implementation conformance | DF-003, DF-004 | drift reason fixture |

## 未決事項

- reference runtime言語とUI stack
- local storeをdirectory log／SQLiteのどちらにするか
- preview rendererの隔離方式
- human reviewer identityをlocal／GitHub／OIDCのどこまで扱うか
- design-system sourceをgit、registry、serviceのどれとして始めるか

これらはconsumerの実装計画とは独立に、Designflow内のADRとして決める。
