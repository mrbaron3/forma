# ADR-0010: GoモジュラーモノリスとReact SPAで全面再実装する

- 状態: Accepted
- 日付: 2026-08-10

## 文脈

Formaはcontract bootstrapのためにJavaScriptでschema検証、authoring port、revision stateを先行実装した。
しかしproduction runtime、review UI、永続化を追加する前に、既存実装との互換性を要件から外し、長期的な
依存境界、再利用性、運用単純性を優先してruntimeを選び直すことにした。

Formaの中心は、immutable revision、human decision、artifact validation、authoring orchestrationを所有する
単一productである。現時点ではbounded contextごとに独立deploy、個別scale、異なる可用性境界を必要としない。
review UIは認証された利用者が設計を確認・比較・判断するapplicationであり、SEOやruntime SSRを要件としない。

## 決定

既存JavaScript実装を移植対象にせず、次の構成で全面再実装する。

- backendはGoのモジュラーモノリスとする。
- frontendはReact／TypeScript SPAとし、Viteでbuildする。
- routingはReact Router Data ModeをUI adapterとして使う。Go以外のserver abstraction、SSR、file-based route
  conventionを持ち込むFramework Mode／full-stack meta-frameworkは初期採用しない。
- frontendは静的assetとしてbuildし、Go serviceまたは独立したstatic hostから配信可能にする。
- backendのHTTP adapterはGo標準`net/http`／`ServeMux`から開始する。Gin、Echo、Fiber等をcore依存にしない。
- CLIとHTTPは同じapplication use caseを呼び、transportごとの状態機械を持たない。
- 最初のmetadata storeはSQLite、previewやbundle等の大きなimmutable contentはfilesystem／blob storeとする。
- Node.js系runtimeはfrontendとcontract toolingのbuild／test時に限定し、production backend runtimeには含めない。
- 初期package managerはnpmとし、lockfileと`npm ci`を標準化する。Bunはproduct runtime、必須tool、lockfile writerに
  しない。将来置換する場合はbuild、test、code generation、lockfileのconformanceを先に証明する。
- bounded contextを最初からmicroserviceへ分割しない。独立deployが必要になった事実をADRで確認してから分割する。

Go内部の依存方向を次で固定する。

```text
inbound adapters (HTTP / CLI)
              │
              ▼
     application use cases ───▶ domain
              ▲
              │ application-owned ports
outbound adapters (SQLite / workspace / sandbox / authoring / export)
```

- `domain`はHTTP、database、filesystem、provider SDK、生成されたprotocol型へ依存しない。
- `application`はuse caseと、そのuse caseが必要とする小さなportを所有する。
- inbound adapterはcontract DTOをapplication command／queryへ変換する。
- outbound adapterはapplicationが定義したportを実装する。
- composition rootだけが具体adapterを組み立てる。
- generated codeはadapter境界に隔離し、domain modelとして使用しない。
- bounded context間でdatabase recordやrepository implementationを共有しない。

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

`utils`、`services`、全context共通の巨大な`models` packageは作らない。共有する概念は、複数use caseで
同じ不変条件を持つことを確認したものだけに限定する。

## 帰結

- backendの実行・配布・並行処理・型安全性はGoへ統一される。
- ReactはGo内部型やstorageを参照せず、公開HTTP contractだけへ依存する。
- SPA、CLI、HTTPで同じapplication semanticsを再利用できる。
- 単一process／SQLiteから開始でき、不要なnetwork境界と分散transactionを避けられる。
- SSR、React Server Components、microservice、別databaseは初期scope外になる。
- React RouterのData Modeはroute data／pending／errorを扱いつつ、bundlerとGo Service API境界をForma側で
  管理できる。Framework Mode固有のserver／route conventionには依存しない。
- 既存JavaScriptの動作は参考資料またはconformance vectorとして利用できるが、コード互換性は維持しない。
- 公開済みcontract releaseと既存ADRは履歴として不変に保ち、新実装から必要なproduct invariantだけを継承する。
- このfrontend選定はFormaのauthoring／review UIに適用する。Design Seed templateのReact／TypeScript toolchainは
  package template versionで独立して固定する。

## 参照

- [ADR-0001: 独立repositoryと公開contract](ADR-0001-standalone-repository-and-open-contract.md)
- [ADR-0009: immutable revision state](ADR-0009-immutable-revision-state.md)
- [Go `net/http` ServeMux](https://pkg.go.dev/net/http#ServeMux)
- [Vite Guide](https://vite.dev/guide/)
- [React Router: Picking a Mode](https://reactrouter.com/start/modes)
