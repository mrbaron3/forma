# Forma

要求仕様から、design foundation、component harness、UI-facing OpenAPI、主要画面mockを段階的に生成し、
人間がbrowserで承認したpayload file treeを、実行可能なDesign Seed Packageとして出力する独立product。

## 出力

Formaの主成果物は、展開後にそのまま新しいrepositoryの初期状態として使えるZIPである。

```text
requirements
  → DESIGN.md / tokens / rules / decisions
  → component contracts / components / stories / tests
  → target OpenAPI / examples / scenarios
  → generated client / mock handlers
  → screens / flows
  → browser review
  → approved Design Seed ZIP
```

ZIPには最低限、次を含む。

- agent向けmapとdesign intent
- version固定したDTCG Format Module profileのtoken
- component variant／state／a11y contract
- reusable componentと全stateのstory
- UI-facing target OpenAPI、参照JSON Schema、schema-valid scenario
- source／license／purpose／trace／invocationを持つoptional visual asset
- OpenAPIから生成したTypeScript client／mock boundary
- 主要screen／flowの実行可能mock
- design rule、decision、static／interaction／a11y／visual test
- stage digest、payload file digest、toolchain provenanceを持つmanifestとdetached approval receipt

詳細は[Design Seed Package](docs/DESIGN_SEED_PACKAGE.md)を参照する。

## 生成とreview

tokenとdesign principleをcomponentより先に、component harnessとUI-facing APIをscreenより先に作る。

1. Requirements Framing
2. Design Foundation Review
3. Component Harness Review
4. Product Contract／OpenAPI
5. Integrated Mock Review
6. Package Approval／ZIP Export

review serverはdraft workspaceそのものをsandboxでbuildする。承認前にpayload manifestを固定し、browserで確認した
payload bytesを再生成せずZIP化する。approvalはZIP圧縮bytesではなくcanonical package manifest digestへ束縛し、
manifest外のdetached receiptとして同梱する。

## API ownership

Formaは生成対象productのUI-facing OpenAPIをDesign Seed Packageへ出力する。Experience Authorがinteraction
capabilityを定義し、API Contract Designerがconcrete operationへ変換する。database、service topology、cloud等の
backend内部設計は決めない。

Forma自身のService API、package内のTarget Product API、integrator自身のControl APIは別contractである。
integratorは、exportされたpackageからtarget productを実装する別repositoryのproductであり、Formaと出力package
はintegratorなしでも利用できる。repository化後はtarget repositoryが`api/openapi.yaml`と参照先`api/schemas/`の
唯一のwriterになり、integratorは同じcontract setを実装入力として利用する。

## 実装方針

- backend: Goのモジュラーモノリス
- authoring／review frontend: React／TypeScript、Vite、React Router Data ModeのSPA
- metadata: SQLite
- draft／approved content: workspace／content store
- generated workspace: credentialとhost accessを持たないsandbox
- package contracts: JSON Schema Draft 2020-12
- frontend build toolchain: Node.js／npm（production backend runtimeには含めない）
- Forma Service API／Target Product API: 分離したOpenAPI 3.1系と外部JSON Schema

既存JavaScript runtimeとの互換性を持たない全面再実装とする。公開済み`contract-v1.0.0-rc.*`と既存ADRは履歴として
維持し、replacement contractは`contracts/next`から新しいmajorへ固定する。

## 独立性

Formaと出力packageは特定consumer、agent provider、Git host、consumer DBなしで利用できる。Formaはconsumerの
Issue、PR、production implementation、releaseを所有しない。export後のtarget repositoryとForma workspaceを
dual-writeしない。

## 読む順

1. [North Star](docs/NORTH_STAR.md)
2. [Design Seed Package](docs/DESIGN_SEED_PACKAGE.md)
3. [設計原則](docs/PRINCIPLES.md)
4. [アーキテクチャ](docs/ARCHITECTURE.md)
5. [ADR-0010: Go／React runtime](docs/decisions/ADR-0010-go-modular-monolith-and-react-spa.md)
6. [ADR-0011: contract authority](docs/decisions/ADR-0011-json-schema-and-openapi-contract-authority.md)
7. [ADR-0012: executable Design Seed Package](docs/decisions/ADR-0012-executable-design-seed-package.md)
8. [ADR-0013: Forma-owned target OpenAPI](docs/decisions/ADR-0013-forma-owned-target-openapi.md)
9. [ADR-0014: provider-neutral authoring](docs/decisions/ADR-0014-provider-neutral-authoring-and-asset-provenance.md)
10. [ADR-0015: seed同梱baseline drift check](docs/decisions/ADR-0015-seed-owned-baseline-drift-check.md)
11. [実行計画](docs/ROADMAP.md)

## 現在の検証

移行期間中の既存contract／fixtureは次で検証する。

```bash
npm ci
npm test
```

Go／React／`contracts/next`のskeleton追加後は、repository共通commandを標準入口にする。
