# Design Seed Package

## 目的

Design Seed Packageは、要求仕様から生成され、人間がbrowserで確認した後、そのまま新しいproduct repositoryの
初期treeとして利用できる実行可能な設計成果物である。Forma固有runtime、database、host path、consumer Issueを
含まず、package単独でbuild、preview、testできなければならない。

主成果物はZIPではなくfile treeである。ZIPはfile treeを渡すtransport、Git repositoryは承認後の継続的な
authoritative writerである。

## Stage model

```text
Requirements Framing
  ↓
Design Foundation
  ↓ foundationDigest
Component Harness
  ↓ componentHarnessDigest
Product Contract
  ↓ targetOpenApiDigest
Integrated Mock
  ↓ integratedMockDigest
Package Approval
  ↓ packageManifestDigest
ZIP / Target Repository
```

各stage revisionは、直接入力した前段digest、toolchain version、authoring provenance、未解決ambiguity、生成fileの
digestを持つ。前段が変われば、それを参照する後段revisionとdecisionはstaleになる。

図の矢印は主要chainを示す。Integrated Mockのように複数の前段を直接入力に持つstageは、参照した全digestを記録する。
Package Approvalはpackage manifest digestへ束縛され、manifestがrequirementsからmockまでの全stage digestを列挙する。

### Requirements Framing

次を固定する。visual designやconcrete APIはこのstageで決めない。

- product purpose、利用者、利用文脈
- primary／secondary taskと成功条件
- 主要flow、safety／audit requirement
- effort budget、attentionの優先順位
- supported viewport、theme、locale、accessibility target
- input requirementと明示的なout of scope

### Design Foundation

値と判断の土台を先に作る。

- `DESIGN.md`: brand、UX principle、対象user、copy policy、Do／Don't、参照map
- `design/tokens/*.tokens.json`: version固定したDTCG Format Module profileのbase／semantic token
- `design/rules.json`: forbid／prefer、severity、scope、verification
- `design/decisions/*.md`: context、decision、consequence、exception、verification

reviewではcolor、typography、spacing、radius、elevation、motion、theme、contrast、copy toneを確認する。

### Component Harness

Foundationを参照する再利用可能componentを作る。

- component contract: variant、直交するstate軸、constraint、a11y、token ref、required test
- React component implementation
- story: rest、hover、pressed、focus-visible、disabled、loading、empty、error、permission、long content、
  narrow viewport、dark mode等、該当する全state
- keyboard、accessible name、focus、interaction、visual regression test

Storybook等のcomponent harnessはdefault template実装であり、package public contractにはしない。別harnessへ
差し替えても同じcomponent contractとtest evidenceを満たさなければならない。

### Product Contract

page／flowのinteractionをcapabilityへ写し、API Contract DesignerがUI-facing OpenAPIへ具体化する。

- operationと安定した`operationId`
- `api/openapi.yaml`: HTTP operation、status、header、security、media type
- `api/schemas/*.schema.json`: request／response JSON bodyのshapeと値制約
- example、scenario、capability／interaction／operation trace
- success、empty、validation、authentication、authorization、conflict、retryable failure
- pagination、filter、sort、freshness
- idempotency、optimistic concurrency、retry、cancel

database、service topology、provider infrastructure、internal-only endpointは含めない。

### Integrated Mock

Foundation、Component Harness、Target Product APIを統合して主要screen／flowを実装する。

- screenはpackage componentを再利用する。
- screenはOpenAPIから生成したclientまたはconformant adapterだけを通じてdataへアクセスする。
- mock handlerとfixtureはOpenAPI schemaへ適合する。
- reviewerがscenario、viewport、theme、localeを切り替えられる。
- selected interactionからoperation、response、UI state、requirementへtraceできる。
- handwritten fixture、direct fetch、literal tokenでcontractを迂回した場合はexport gateを失敗させる。

## Package layout

初期templateは次を基準とする。schema上のroleを保てる限り、将来のformat versionで配置を変更できる。

```text
design-seed/
├─ .github/
│  └─ workflows/
├─ AGENTS.md
├─ DESIGN.md
├─ README.md
├─ forma.package.json
├─ forma.approval.json
├─ package.json
├─ package-lock.json
├─ requirements/
│  ├─ requirements.md
│  └─ trace.json
├─ design/
│  ├─ tokens/
│  ├─ contracts/
│  ├─ rules.json
│  └─ decisions/
├─ api/
│  ├─ openapi.yaml
│  ├─ schemas/
│  ├─ capabilities.json
│  ├─ examples/
│  ├─ scenarios/
│  └─ trace.json
├─ assets/
│  └─ catalog.json
├─ public/
│  └─ assets/
├─ src/
│  ├─ api/generated/
│  ├─ mocks/generated/
│  ├─ components/
│  └─ screens/
├─ stories/
└─ tests/design/
```

`forma.approval.json`はapproval前のdraft workspaceには存在せず、export時に追加するdetached receiptである。
`AGENTS.md`は作業方法と参照先の短いmapに留め、値や仕様を複製しない。generated directoryは手編集禁止とし、
source contractからの再生成差分が空であることをCIで検査する。同じCIがbaseline driftのcheckも実行する
（[ADR-0015](decisions/ADR-0015-seed-owned-baseline-drift-check.md)）。

初期templateはNode.js／npmでtoolchainを固定し、`npm ci`で再現する。Bunをpackageの必須runtimeやlockfile writerには
しない。toolchainを変更する場合はtemplate versionを上げ、build、test、code generation、lockfileの再現性を
同じconformance suiteで証明する。

## Manifest, digest, and approval receipt

`forma.package.json`は承認対象payloadのcontent manifestであり、少なくとも次を識別する。

- package format version
- package ID、design request ID、stage revision ID
- normalized requirement snapshot digest
- requirements／foundation／component harness／OpenAPI／mock digest
- JSON Schema、OpenAPI、DTCG profileの固定version
- toolchain／template version
- entrypoint: application、component harness、OpenAPI
- fileごとのnormalized relative path、role、media type、SHA-256
- generated fileが参照するauthor invocation key
- keyed author invocation provenanceとAuthoringProfile revision／digest

host path、GitHub Issue、consumer database ID、Forma database recordを含めない。pathはplatform-neutralな正規化済み
relative pathとする。payload file inventoryは`forma.package.json`自身と`forma.approval.json`を列挙しない。

manifest digestはcanonical JSONから計算する。ZIPのtimestamp、entry order、compression methodは承認identityに
含めない。

`forma.approval.json`はdetached receiptであり、verdict、actor、time、rationale、`packageManifestDigest`を持つ。
manifest内にapprovalを埋め込んだりmanifest自身のdigestを列挙したりして循環参照を作らない。export archiveのentryは
次の集合と完全一致させる。

```text
manifest.files
+ forma.package.json
+ forma.approval.json
```

exporterはarchive展開後にpayload digest集合、canonical manifest digest、receipt bindingを再現できなければならない。

## Authoring provenance

Design Requestはproviderを選ばない。運用側のversion固定AuthoringProfileがstage／artifact roleをauthoring portへrouteし、
deterministic mockとproduction adapterは同じconformance suiteを通す。implicit fallback、同一fileへの複数writer、
source mutationを拒否する。

各generated fileはmanifest内のexactly one invocation keyを参照する。invocation recordはprovider role、tool／model、
optional orchestrator、profile revision／digest、input snapshot digest、instruction digest、output path／digestを持つ。
provider credential、private prompt本文、tool transcriptはpackageへ含めない。詳細は
[ADR-0014](decisions/ADR-0014-provider-neutral-authoring-and-asset-provenance.md)に従う。

## Visual assets

画像、illustration、icon等を必要とする場合はoptionalなfirst-class payloadとして扱う。`assets/catalog.json`は各assetの
ID、kind、`public/assets/`配下path、media type、dimensions、source kind、license／usage status、purpose、
requirement／element trace、author invocation keyを持つ。binary fileもmanifestへ列挙し、同じdigest検証を行う。

sourceまたはlicense／usage statusが不明なasset、目的へtraceしないasset、catalog外asset、同じpathへの複数invocationを
exportしてはならない。provider credential、private prompt、tool transcriptはcatalogやpackageへ含めない。

## Browser review

review serverはdraft workspaceをsandbox内でbuildし、次のsurfaceを提供する。

1. Foundation: token、type scale、spacing、theme、contrast、copy sample
2. Components: variant、state、interaction、a11y evidence
3. Screens: route、flow、viewport、locale、scenario
4. API trace: interaction→operation→success／failure→UI state
5. Diff: 前stage revisionから変わったfile、token、component contract、operation、screen
6. Decision: approve、request-changes、rejectと、対象stage／manifest digest

raw JSON／YAMLは補助表示とし、reviewの第一面にしない。

## Export gates

Package Approval前に最低限、次をすべて通す。

- token reference、component contract、rule、decision referenceの整合
- component story／required state／a11y test coverage
- OpenAPI lint、example／scenario schema validation
- 全UI capabilityのoperation coverageと全operationのscreen／flow trace
- generated client／mockの再生成差分なし
- generated fileとassetのexactly-one invocation provenance
- asset source／license／purpose／requirement traceの完全性
- screenからのdirect HTTP、schema外fixture、literal tokenの禁止
- application／Storybook build
- targeted test、headless browser flow、accessibility check
- manifestとreview対象payload file集合／digestの完全一致
- approval後にpayloadを変更していないこと
- detached receiptがmanifest digestを参照し、archiveに未列挙entryがないこと

## Authority handoff

Formaはdraft workspaceとapproved packageを所有するが、consumerの継続開発を所有しない。ZIPを展開して
repository化した時点から、target repositoryがfile treeとTarget Product API contract set
（`api/openapi.yaml`、`api/schemas/`、example、scenario、trace）の唯一のauthoritative writerになる。
integratorは同じcontract setを参照し、変更はtarget repositoryへのPRとして行う。

Formaへ戻して再設計する場合は、target repositoryの特定commitを新しいsource snapshotとしてimportし、新しい
stage revisionを作る。Forma workspaceとtarget repositoryを同期するdual-writeは行わない。

seed commit以後にtarget repositoryへfileを追加・変更した場合、同梱manifest／receiptは初期承認baselineの履歴になる。
既存manifestやreceiptを書き換えて現在commitも承認済みに見せてはならない。repository検証はarchiveの完全一致検証と
分け、baselineからのdiffとapproval stale状態を報告する。この検証はseedが同梱するcheckとしてtarget repositoryが
所有し、Forma runtimeもintegrator側の実装も必要としない（[ADR-0015](decisions/ADR-0015-seed-owned-baseline-drift-check.md)）。Formaで再承認したcandidateはtarget repositoryへ直接同期せず、
同repositoryの通常のPRとして適用する。

## Non-goals

- production backend implementation
- database／service／cloud architectureの決定
- consumerのIssue／PR／release管理
- Figma等の特定design toolを正本にすること
- Forma／integratorのControl APIをpackageへ埋め込むこと
- approval後のtarget repositoryをFormaが継続的に書き換えること
