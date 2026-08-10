# Roadmap

## 進め方

Formaは既存JavaScript実装との互換性を持たない全面再実装を行う。backendはGo、authoring／review UIは
React／TypeScriptとする。ただしruntime skeletonから先に広げず、人間が受け取るDesign Seed Packageを最小の
end-to-end sliceとして成立させる。

```text
Package contract / template
  → Design Foundation
  → Component Harness
  → UI-facing OpenAPI / generated mock
  → Production Authoring / Visual Assets
  → Integrated Mock / browser approval
  → Exact-payload ZIP export
  → Target repository / Integrator handoff
```

判断の正本:

- [ADR-0010: GoモジュラーモノリスとReact SPA](decisions/ADR-0010-go-modular-monolith-and-react-spa.md)
- [ADR-0011: JSON SchemaとOpenAPIの契約責務](decisions/ADR-0011-json-schema-and-openapi-contract-authority.md)
- [ADR-0012: 実行可能なDesign Seed Package](decisions/ADR-0012-executable-design-seed-package.md)
- [ADR-0013: Forma-owned UI-facing target OpenAPI](decisions/ADR-0013-forma-owned-target-openapi.md)
- [Design Seed Package specification](DESIGN_SEED_PACKAGE.md)

## Version and historical assets

- 公開済み`contract-v1.0.0-rc.*`、release tag、既存ADRを変更しない。
- replacement contractは開発中`contracts/next`、公開時に新しいmajorへ固定する。
- v1 document、runtime API、npm package exportsのcompatibility adapterは実装しない。
- 既存fixtureからcanonicalization、negative validation、immutable decision等の検証意図だけを新conformance vectorへ移す。
- Design Seed Package format、target template、Forma Service APIを別versionとして扱う。

## Phase R0 — Package baseline

目的: 何を生成し、何をbrowserで承認し、何をZIPへ含めるかを実行可能な最小templateで固定する。

- [x] Go／React runtime ADR
- [x] JSON Schema／OpenAPI authority ADR
- [x] Design Seed Package ADR／specification
- [x] UI-facing target OpenAPI ownership ADR
- [ ] `contracts/next`のpackage manifest／stage revision／decision schema
- [ ] Design Seed最小template
- [ ] templateの`AGENTS.md`、`DESIGN.md`、package manifest
- [ ] payload file inventory／canonical manifest digest／detached approval receipt／ZIP round-trip prototype
- [ ] package verify CLI prototype
- [ ] repository共通validation command

Exit:

- fixture packageをnetwork accessなしでvalidateできる
- browser review対象payloadとexport payloadのdigest集合が一致する
- ZIPのtimestamp／compression差でpackage identityが変わらない
- absolute path、traversal、symlink escape、未列挙fileを拒否する
- packageを展開してdocumented commandでbuild／testできる

## Phase R1 — Design Foundation vertical slice

目的: 要求仕様からtokenとdesign ruleを生成し、人間がbrowserで理解・修正・承認できる。

- Go module、CLI、SQLite、workspace storeの最小skeleton
- application-owned stage authoring portとdeterministic mock adapter
- Forma Service APIの最小OpenAPI／JSON Schema contract
- OpenAPI生成TypeScript clientとCLI／HTTP application parity
- React review shellの最小skeleton
- Requirements Framing contract
- `DESIGN.md` authoring
- version固定したDTCG Format Module profileによるbase／semantic token authoring
- rule／decision／exception authoring
- Foundation preview: palette、type scale、spacing、radius、elevation、motion、theme、copy
- Foundation revision／digest／decision

Exit:

- requirement→Foundation candidate→request-changes→new revision→approveを一巡する
- token reference、rule／decision reference、contrastを検証する
- approved Foundation fileを変更せず次stageへ渡す
- process restart後もrevision、decision、workspace provenanceを復元する
- ReactとCLIが同じapplication semanticsをForma Service API／port経由で利用する

## Phase R2 — Component Harness

目的: approved Foundationから再利用可能componentと全stateの実行証拠を作る。

- component contract schema
- variant、state axis、constraint、a11y、token ref、required test
- React component template
- component harness／Storybook default adapter
- required state story generation
- keyboard、focus、accessible name、interaction、visual test
- component diff／review projection
- Foundation digestへの依存とstale propagation

Exit:

- Button、form control、navigation等の最小component setがsemantic tokenだけを使う
- loading、disabled、focus、error、permission、long content、narrow viewport等の該当stateをreviewできる
- component contractとstory／test coverageの欠落をfail closedにする
- Foundation変更で依存するComponent Harness approvalがstaleになる

## Phase R3 — Product Contract and generated mock boundary

目的: UI interactionをconcrete OpenAPIへ写し、schema-validなmockを生成する。

- Experience Authorのcapability contract
- API Contract Designer authoring port
- target `api/openapi.yaml`と`api/schemas/*.schema.json`
- capability／interaction／`operationId` trace
- OpenAPI lint、example／scenario validation
- TypeScript client／validator／mock handler generation
- success、empty、validation、unauthorized、forbidden、conflict、retryable failure、slow response scenario
- OpenAPI diff projection

Exit:

- 全UI capabilityがoperationへ完全traceする
- target operationにscreen／flowまたは明示的rationaleがある
- example／scenarioがrequest／response schemaへ適合する
- generated sourceを再生成して差分がない
- Forma Service API、Target Product API、Servo Control APIを混在させない

## Phase R4 — Integrated Mock and package approval

目的: component harnessとtarget OpenAPIを使う主要screen／flowをbrowserで確認し、同じpayloadをZIP出力する。

- screen／route／flow authoring
- version固定したAuthoringProfileとroute validation
- 少なくとも一つのreal production authoring adapter
- generated fileごとのexactly-one invocation provenance
- optional visual asset catalog、source／license／purpose／trace、binary digest
- generated client／mock handlerだけを使うdata boundary
- scenario、viewport、theme、locale switcher
- element→component→interaction→operation→response UI state trace
- screen／flow／OpenAPI／component diff
- sandbox build／serve／test
- package manifest／detached approval receipt assembly
- digest-bound Package Approval
- exact-payload ZIP export／verify

Exit:

- 主要flowをsuccessと主要failure scenarioでheadless browser実行できる
- fixture requirementからreal providerでFoundation→Component→Product Contract→Integrated Mockを生成できる
- provider unavailable、wrong route、implicit fallback、source mutation、unknown asset licenseをfail closedにする
- literal token、local component fork、direct fetch、schema外fixtureを検出する
- reviewerがraw JSONなしでFoundation、component、screen、API差分を判断できる
- approval後のworkspace mutationを拒否する
- browserで確認したpayload digest集合とZIP展開後のpayload集合が完全一致する

## Phase R5 — Repository and integrator handoff

目的: Design Seed Packageをtarget repositoryの初期authorityとして安全に引き渡す。

- repository seed metadataとimport provenance
- target commitをsource snapshotとして再importするrevision path
- provider／consumer非依存のpackage manifest／digest integrator fixture
- target `api/openapi.yaml`と参照schemaを単一contract setとして検証するhandoff test
- material API change→Forma re-review policy
- package format／template release artifact

Exit:

- Forma runtimeなしでtarget repositoryをbuild／preview／testできる
- generic integratorがTarget Product APIを複製せずtarget contract setから実装を開始できる
- target repository化後、Formaが同じfile treeを継続writeしない
- 特定target commitから新しいForma revisionを再現可能に開始できる
- seed後のrepository diffを旧approvalのstale状態として検出し、manifest／receiptを書き換えない
- consumer Issue／PR／release lifecycleをForma contractへ流入させない

Servo等のlive adapter、consumer固有dogfood、consumer repositoryのIssue／PRは各consumerが所有し、本Phaseの
dependencyやcompletion evidenceにしない。

## Future — Production implementation conformance

v0完了後の独立scopeとして、target repositoryのimplementation evidenceを承認baselineへ照合する。Package archiveの
完全性、seed後のstale diff、production implementation conformanceを同一概念にしない。

- token／component／state／accessibility／visual evidence coverage
- Target Product API implementation conformance
- approved baseline、current commit、evidence revisionの明示
- consumer lifecycleをimportしないgeneric report

Exit:

- 任意のtarget implementation driftをmissing／stale／wrong revisionへ理由付きで分類できる
- consumer repositoryへ書き込まず、提供されたsnapshot／evidenceだけでreportを再現できる

## Validation order

各Phaseで速い検証から実境界へ進む。

1. targeted domain／schema／generator test
2. template static checkとgenerated drift check
3. workspace／SQLite integration
4. package build／component harness test
5. CLI／HTTP black-box parity
6. headless browser review／export E2E
7. sandbox isolation、browser lifecycle、支援技術、device固有の最小headed／実device確認

headlessで代替できない境界をheadless結果だけで完了扱いにしない。

## Existing implementation removal

既存`src/*.js`、Node runtime test、`package.json` exportsは新runtimeの互換対象ではない。Phase R0で次の検証意図を
新conformanceへ移し、共通validation入口が成立した後に削除する。

- canonical JSON／digest
- positive／negative schema fixture
- immutable revision／decision
- authoring provenance／mutation／trace violation

公開済みcontract directory、release tag、ADRは削除・変更しない。

## Task key

旧roadmapの`DF-NNN` issueは履歴として扱い、新しい依存関係には使用しない。全面再実装taskは`FM-NNN`を使用し、
Phase R0から新しいDAGを作る。consumer固有task、cross-repository Issue dependency、共有DB、dual-writeを作らない。

keyは`FM-RPP`（`R`はPhase、`PP`はPhase内連番）を基準とし、全taskは`FM-000` Epicへ属する。Future scopeは
`FM-9PP`を使う。具体issue linkと現在の次taskは[HANDOFF](HANDOFF.md)で管理する。
