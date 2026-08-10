# Handoff

最終更新: 2026-08-10

## 現在地

Formaのproduct outputを全面的に再定義した。主成果物は抽象JSON Bundleではなく、要求仕様から段階的に生成され、
人間がbrowserで承認したpayload file treeをそのままZIP／target repositoryへ渡す、実行可能な
**Design Seed Package**である。

生成順はRequirements Framing→Design Foundation→Component Harness→UI-facing OpenAPI→Integrated Mock→
Package Approval／Exportとする。tokenとdesign principleをcomponentより先に、component contractとOpenAPIを
screenより先に固定する。

Formaはtarget productのUI-facing OpenAPIまで出力する。Experience Authorはcapabilityを記述し、Forma内の
API Contract Designerがconcrete operationへ変換する。Mock BuilderはOpenAPIからTypeScript client、validator、
handler、scenarioを生成する。database、service topology、cloud等のbackend内部設計はscope外である。

## 新しい正本

- [North Star](NORTH_STAR.md)
- [Design Seed Package](DESIGN_SEED_PACKAGE.md)
- [Product Design Principles](PRINCIPLES.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [ADR-0010: GoモジュラーモノリスとReact SPA](decisions/ADR-0010-go-modular-monolith-and-react-spa.md)
- [ADR-0011: JSON SchemaとOpenAPIの契約責務](decisions/ADR-0011-json-schema-and-openapi-contract-authority.md)
- [ADR-0012: 実行可能なDesign Seed Package](decisions/ADR-0012-executable-design-seed-package.md)
- [ADR-0013: Forma-owned target OpenAPI](decisions/ADR-0013-forma-owned-target-openapi.md)
- [ADR-0014: provider-neutral production authoring](decisions/ADR-0014-provider-neutral-authoring-and-asset-provenance.md)

新実装のGo／React skeleton、`contracts/next`、Design Seed templateはまだ作成していない。新Roadmapの実装DAGは
[FM-000 Epic #27](https://github.com/mrbaron3/forma/issues/27)へ固定した。現在の次工程はRoadmap Phase R0の
[FM-001 #28](https://github.com/mrbaron3/forma/issues/28)である。

## Issue DAG

- Epic: [FM-000 #27](https://github.com/mrbaron3/forma/issues/27)
- R0 Package baseline: [FM-001 #28](https://github.com/mrbaron3/forma/issues/28)〜
  [FM-004 #31](https://github.com/mrbaron3/forma/issues/31)
- R1 Design Foundation: [FM-101 #33](https://github.com/mrbaron3/forma/issues/33)、
  [FM-102 #32](https://github.com/mrbaron3/forma/issues/32)、
  [FM-103 #34](https://github.com/mrbaron3/forma/issues/34)、
  [FM-104 #35](https://github.com/mrbaron3/forma/issues/35)
- R2 Component Harness: [FM-201 #37](https://github.com/mrbaron3/forma/issues/37)、
  [FM-202 #36](https://github.com/mrbaron3/forma/issues/36)、
  [FM-203 #38](https://github.com/mrbaron3/forma/issues/38)
- R3 Product Contract: [FM-301 #41](https://github.com/mrbaron3/forma/issues/41)、
  [FM-302 #40](https://github.com/mrbaron3/forma/issues/40)、
  [FM-303 #39](https://github.com/mrbaron3/forma/issues/39)
- R4 Production Authoring／Integrated Mock／Approval: [FM-401 #42](https://github.com/mrbaron3/forma/issues/42)〜
  [FM-404 #45](https://github.com/mrbaron3/forma/issues/45)
- R5 Repository Handoff: [FM-501 #46](https://github.com/mrbaron3/forma/issues/46)〜
  [FM-503 #48](https://github.com/mrbaron3/forma/issues/48)
- Future implementation conformance: [FM-901 #49](https://github.com/mrbaron3/forma/issues/49)（v0完了条件外）

旧open issue #1、#2、#3、#5、#6、#7、#9、#10は、後継FM issueへのlinkを残して`not planned`でcloseした。
旧実装の完了履歴と既存ADRは変更せず保持する。

## 確定した判断

### Product output

- 主成果物は単独でbuild、preview、testできるDesign Seed file treeである。
- ZIPはtransportであり、approval identityはcanonical package manifest digestである。
- reviewしたpayloadをapproval後に再生成せず、同じfile bytesとdetached approval receiptをarchiveする。
- stage revisionは前段digestを持ち、前段material changeは依存する後段approvalをstaleにする。
- packageは`AGENTS.md`、`DESIGN.md`、token、component contract／implementation／story／test、rule、decision、
  normalized requirements／trace、target OpenAPI／JSON Schema、scenario、generated client／mock、optional visual asset、
  screen、manifestを含む。

### OpenAPI

- Forma Service API、Target Product API、Servo Control APIを別contractとして扱う。
- Target Product APIはDesign Seed Package内`api/openapi.yaml`と参照先`api/schemas/`を正本setとする。
- Go domain modelからTarget Product APIを生成しない。
- screenはOpenAPI生成client／mock boundaryを迂回しない。
- target repository化後はtarget repositoryが唯一のwriterになり、Servoは同じcontract setを実装入力として使う。
- ServoへOpenAPIのcopyを置かず、変更はtarget repositoryへのPRで行う。
- approved UI-facing operation／schemaのmaterial changeはFormaの新revisionとして再reviewする。

### Runtime

- Forma backendはGoのモジュラーモノリスとする。
- authoring／review UIはReact／TypeScript、Vite、React Router Data ModeのSPAとする。
- HTTP adapterは標準`net/http`／`ServeMux`から開始する。
- metadataはSQLite、draft／approved contentはworkspace／content storeから開始する。
- generated Design Seed workspaceはuntrusted sourceとして別sandboxでbuild／serve／testする。
- frontend／contract buildはNode.js／npmへ固定し、production backend runtimeには含めない。
- TypeSpec、Go web framework、full-stack frontend framework、SSR、Bun runtime／lockfile、microserviceは初期構成に
  採用しない。

### Authoring

- stage／artifact roleごとのapplication-owned portをprovider adapterが実装する。
- Design Requestはproviderを指定せず、version固定したAuthoringProfileがrouteを所有する。
- deterministic mockと少なくとも一つのproduction adapterを同じconformance suiteへ通す。
- generated fileはexactly one invocationへtraceし、implicit fallbackと複数writerを禁止する。
- optional visual assetはsource、license／usage status、purpose、requirement／element、invocationへtraceする。

### Historical boundary

- 公開済み`contract-v1.0.0-rc.*`と既存ADRを変更しない。
- 新実装はv1 compatibility adapterを持たない。
- replacement contractは`contracts/next`から新majorへ固定する。
- 既存JavaScript codeは移植せず、検証意図をconformance vectorへ移してから削除する。

## 次のアクション

1. `contracts/next`にpackage manifest、stage revision、decisionの最小schemaを作る。
2. `templates/design-seed`にnormalized requirements、target API schema directoryを含む最小の独立実行可能templateを作る。
3. canonical payload manifest digest、detached approval receipt、ZIP round-trip verifierを実装する。
4. `go.mod`、`cmd/forma`、`internal/{domain,application,adapter}`の最小skeletonを作る。
5. Forma Service APIの最小OpenAPI／JSON Schemaと生成TypeScript clientを作る。
6. `web`へFoundation reviewだけを行う最小React SPAを作る。
7. fixture requirementからFoundation candidateを生成し、request-changes→approve→ZIP exportを通す。
8. 既存canonicalization／revision fixtureを新conformance vectorへ移す。

最初のvertical sliceではcomponent、OpenAPI、screenを同時実装しない。まずRequirements→Foundation Review→
開発用partial ZIPの細い経路で、stage revision、decision、manifest、sandbox preview、exportの骨格を証明する。
これは最終Design Seed Packageのapproval完了とは扱わない。

## 継承するproduct invariant

- Formaと出力packageは特定consumer repositoryなしで利用できる。
- material changeは新しいimmutable revisionを作る。
- human decisionはstage revisionまたはpackage manifest digestへ束縛する。
- page／element／interactionはpurpose、task、requirement、safety、rationaleへtraceする。
- live integrationのauthoritative writerは一つとし、DB共有とdual-writeを行わない。
- consumer Issue、PR、production implementation、releaseをFormaが所有しない。

## 再開時の確認

移行期間中は既存contract／fixtureを次で確認する。

```bash
git status --short --branch
npm test
```

Go／React／`contracts/next`追加後はrepository共通commandをここへ追記し、`npm test`単独を標準入口にしない。

## 読む順

1. [North Star](NORTH_STAR.md)
2. [Design Seed Package](DESIGN_SEED_PACKAGE.md)
3. [ADR-0012](decisions/ADR-0012-executable-design-seed-package.md)
4. [ADR-0013](decisions/ADR-0013-forma-owned-target-openapi.md)
5. [Principles](PRINCIPLES.md)
6. [Architecture](ARCHITECTURE.md)
7. [Roadmap](ROADMAP.md)

## 意図的に未着手

- Go／React repository skeleton
- `contracts/next`
- Design Seed template
- sandbox selection／implementation
- concrete Forma Service API paths
- authentication／reviewer identity
- production authoring provider（Roadmap R4）
- Servo live adapter
- v1 compatibility layer（実装しない）
