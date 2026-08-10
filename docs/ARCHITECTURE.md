# Architecture

## System boundary

Formaは要求仕様を受け、design foundation、component harness、UI-facing API、integrated mockを段階的に生成・検証し、
人間がbrowserで承認したpayload file treeをDesign Seed Packageとして出力する独立systemである。

```text
Requirement Input
  → Requirements Framing
  → Design Foundation
  → Component Harness
  → Product Contract / OpenAPI
  → Integrated Mock
  → Browser Review / Revision
  → Package Approval
  → ZIP / Target Repository
```

Formaは生成したtarget productのproduction実装、Issue／PR、release、database、service topologyを所有しない。

## Primary output

主成果物はcontent-addressedな[Design Seed Package](DESIGN_SEED_PACKAGE.md)である。preview HTMLや抽象JSON artifactを
主成果物にしない。review serverはdraft workspaceそのものをsandboxでbuildし、approval前にpayload manifestを
固定する。approval後はpayloadを再生成せず、detached approval receiptだけを加えてZIP化する。

```text
Design Seed Package
├─ intent       normalized requirements / DESIGN.md / requirement trace
├─ foundation   token / rule / decision
├─ components   contract / implementation / story / test
├─ product API  OpenAPI / JSON Schema / example / scenario / trace
├─ assets        catalog / media / source / license / provenance
├─ mock          screen / flow / generated client / generated handler
└─ evidence      payload manifest / detached approval / toolchain provenance
```

## Stage dependency

```text
Requirements Revision
       │
       ▼
Foundation Revision ───────────────┐
       │ foundationDigest          │
       ▼                           │
Component Harness Revision         │
       │ componentHarnessDigest    │
       ▼                           │
Product Contract Revision          │
       │ targetOpenApiDigest       │
       ▼                           │
Integrated Mock Revision ◀─────────┘
       │ integratedMockDigest
       ▼
Package Manifest Revision
```

各revisionはimmutableで、直接入力した前段digestを保持する。前段material changeは依存する後段decisionをstaleに
する。stageを一つの巨大snapshotへ平坦化せず、どの判断が何に依存したかを保持する。

## Bounded contexts

### Requirements Framing

product purpose、user、flow、success、constraint、effort、attention、viewport、locale、accessibility target、
out of scopeを所有する。consumer Issueや既存DB recordを公開contractへ持ち込まない。

### Design Foundation

`DESIGN.md`、version固定したDTCG Format Module profileのtoken、design rule、design decision、exceptionを所有する。
screen固有CSSやcomponent behaviorをtokenへ混在させない。

### Component Harness

component variant、state axis、constraint、a11y、token ref、required story／testと、実行可能component harnessを
所有する。Foundation digestへ束縛する。

### Product Contract

Experience Authorがinteraction capabilityを著述し、API Contract Designerがtarget productのUI-facing OpenAPIへ
具体化する。Mock Builderがclient、validator、handler、scenarioを生成する。database、service topology、
provider-specific infrastructureは所有しない。判断は
[ADR-0013](decisions/ADR-0013-forma-owned-target-openapi.md)を正本とする。

### Integrated Mock

package componentとOpenAPI生成boundaryを使って主要screen／flowを実装する。success、loading、empty、validation、
permission、failure、slow response等のscenarioをbrowserで再現する。literal token、local component fork、direct
HTTP、schema外fixtureをfail closedにする。

### Authoring Orchestration

stage／artifact roleごとのapplication-owned port、version固定したAuthoringProfile、route validation、invocation provenanceを
所有する。deterministic mockとproduction provider adapterへ同じconformanceを適用し、implicit fallback、同一fileへの
複数writer、source mutationを拒否する。provider固有SDK型、credential、host commandをdomain／packageへ持ち込まない。

Visual Asset Generatorの出力は`assets/catalog.json`と`public/assets/`へ格納し、source、license／usage status、purpose、
requirement／element、invocationへtraceする。判断は
[ADR-0014](decisions/ADR-0014-provider-neutral-authoring-and-asset-provenance.md)を正本とする。

### Human Review

stage別surface、diff、trace、ambiguity、validation evidenceを投影し、Human Design Decisionをstage revisionまたは
package manifest digestへ束縛する。raw contract fileを第一review surfaceにしない。

### Package Assembly

workspace payloadをnormalized relative path、role、media type、SHA-256でmanifestへ固定する。approval後に再生成せず、
manifestが指す同じbytesと、そのmanifest digestを参照するdetached approval receiptをZIPへ格納する。archiveを展開して
payload集合、digest、receipt bindingを再検証できなければならない。

## Implementation architecture

Forma自身は[ADR-0010](decisions/ADR-0010-go-modular-monolith-and-react-spa.md)に従い、Goのモジュラーモノリスと
React／TypeScript、Vite、React Router Data ModeのSPAで実装する。

```text
React authoring / review UI
              │ Forma Service API
              ▼
HTTP adapter ─┐
CLI adapter  ─┼─▶ Application use cases ─▶ Domain
              │           ▲
              │           │ application-owned ports
              └── SQLite / workspace / sandbox / authoring / export adapters
```

- domainはHTTP、CLI、database、filesystem、sandbox、agent SDK、React、generated protocol typeを知らない。
- applicationはstage use caseと必要なportを所有する。
- adapterはcontract DTOをapplication command／queryへ変換する。
- composition rootだけが具体adapterを組み立てる。
- generated codeをdomain modelとして使わない。
- bounded contextを初期段階で別serviceへ分割しない。

初期directory境界は次を基準とする。

```text
cmd/forma/
internal/domain/
internal/application/
internal/adapter/inbound/{http,cli}/
internal/adapter/outbound/{sqlite,workspace,sandbox,authoring,export}/
internal/platform/
internal/generated/
web/
contracts/
templates/design-seed/
```

`utils`、`services`、巨大な共通`models` packageを作らない。template内のsourceとForma runtime sourceを同じpackage
またはmoduleへ混在させない。

## Contract families

契約を用途で分離する。

| Contract family | 正本 | 用途 |
|---|---|---|
| Design Seed Package | JSON Schema Draft 2020-12 | manifest、stage、decision、trace、rule／component format |
| Target Product API | package内OpenAPI 3.1系＋外部JSON Schema | mock UIと将来backendのconsumer contract |
| Forma Service API | Forma側OpenAPI 3.1系＋外部JSON Schema | Formaのrequest、stage、review、export操作 |
| Behavioral conformance | executable vector | digest、dependency invalidation、generation、mock、export |

公開済み`contract-v1.0.0-rc.*`はimmutableな履歴として維持するが、新実装はv1互換adapterを持たない。
replacement contractは`contracts/next`で開発し、新しいmajorへ固定する。

```text
contracts/next/
├─ schemas/
│  ├─ package/
│  ├─ stage/
│  ├─ design/
│  └─ errors/
├─ forma-service/
│  └─ openapi.yaml
├─ conformance/
└─ examples/
```

Target Product APIは各draft workspace／Design Seed Package内の`api/openapi.yaml`と`api/schemas/`を正本setとし、
Forma repositoryのService API contractへ混在させない。Target Product APIをGo domain modelから生成しない。

JSON body shape、OpenAPIとの責務分離、format assertion、release-local reference等の共通profileは
[ADR-0011](decisions/ADR-0011-json-schema-and-openapi-contract-authority.md)を適用する。

## Target OpenAPI and mock generation

```text
Interaction
  → Capability
  → api/openapi.yaml
       ├─ api/schemas/*.schema.json
       ├─ generated TypeScript client
       ├─ generated validator
       ├─ generated mock handler
       └─ schema-valid examples / scenarios
              ↓
         Integrated Mock Screen
```

export gateは次を検証する。

- 全UI capabilityが一つ以上の`operationId`へtraceする。
- 全target operationがscreen／flowまたは明示的product rationaleへtraceする。
- mock responseとscenarioがOpenAPI schemaへ適合する。
- generated sourceの再生成差分がない。
- screenがgenerated client／conformant adapterを迂回しない。
- OpenAPI diffで影響するscreen、state、componentを列挙できる。

## Public ports

### Local CLI

目標形:

```text
forma create --requirements requirements.md
forma generate foundation <request-id>
forma generate components <request-id>
forma generate contract <request-id>
forma generate mock <request-id>
forma serve <request-id>
forma status <request-id>
forma decide <stage-revision-id> --verdict ...
forma export <package-revision-id> --format zip
forma verify <design-seed.zip>
```

具体command名はCLI contract策定時に固定する。CLIとHTTPは同じapplication use caseを呼び、別のstage semanticsを
持たない。

### Forma Service API

request intake、stage generation、status／artifact projection、decision、exportを提供する。具体pathはOpenAPI策定時に
決め、planning proseへ先に固定しない。Webhook、MCP、Git provider integrationはoptional adapterである。

### Package handoff

Design Seed ZIPとpackage manifestがconsumer boundaryである。Formaはconsumer repositoryへ継続的に書き込まず、
GitHub Issue／PR／release lifecycleを公開package contractへ含めない。

## State ownership

Formaが所有:

- requirement source snapshot
- stage revisionとdependency digest
- draft workspace
- authoring provenanceとambiguity
- sandbox preview evidence
- Human Design Decision
- approved package manifestとexport artifact

Target repositoryがexport後に所有:

- Design Seed file tree
- target `api/openapi.yaml`と参照先`api/schemas/`
- production implementation
- Issue／PR／release
- packageを起点とした後続design decision

authority transfer後にFormaとtarget repositoryが同じfileをdual-writeしない。再設計はtarget commitを新source
snapshotとしてimportする新revisionで行う。seed commit後のmanifest／receiptは承認baselineとしてimmutableに保ち、
現在treeとの完全一致を装わない。再承認candidateはtarget repositoryへの通常のPRとして反映する。

## Storage and deployment

最初は単一Go process、SQLite metadata store、workspace／content filesystemで動作させる。SQLite record、host path、
sandbox identifierは公開contractへ出さない。approved immutable contentはdigestでaddressし、metadata transactionと
content finalizeの失敗境界を明示する。

React review UIはGo binaryへembedしても独立static hostへ配置してもよい。Design Seed workspaceのapplication／
component harnessはuntrusted generated sourceとして別sandboxでbuild、serve、testする。Forma processと同じruntime
権限で実行しない。

## Validation strategy

検証順序の正本。速い境界から順に検証する。

1. Go domain／applicationのtargeted unit test
2. JSON Schema／OpenAPI／example／scenario validation
3. dependency、digest、approval invalidationのconformance vector
4. template static check、generated-file drift check
5. workspace／SQLite integration test
6. sandbox内component harness／application buildとtest
7. CLI／HTTP parity test
8. headless browserでfoundation、component、screen、API scenario、export E2E
9. sandbox isolation、browser lifecycle、支援技術、device固有境界だけを最小headed／実deviceで確認

headlessで代替できない境界をheadless結果だけで完了扱いにしない。

## Security

- requirement text、agent output、template inputをuntrusted dataとして扱う。
- generated workspaceはnetwork、credential、host filesystem、Forma databaseへ既定で到達できないsandboxで実行する。
- package pathはnormalized relative pathに限定し、archive traversal、symlink escape、absolute pathを拒否する。
- browser previewはsandbox originへ隔離し、Forma session credentialを渡さない。
- authoring agentは明示されたsnapshotとworkspace以外へ書き込まない。
- secret、host path、shell command、provider credential／internal configurationをDesign Seed Packageへ混入させない。
- generated file／assetをexactly one author invocationへtraceし、license status不明のassetをexportしない。
- decisionのactor、time、stage revision、manifest digest、rationaleを監査可能にする。
