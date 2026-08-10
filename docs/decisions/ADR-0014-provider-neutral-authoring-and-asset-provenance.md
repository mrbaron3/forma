# ADR-0014: production authoringをprovider-neutral portとfile provenanceで扱う

- 状態: Accepted
- 日付: 2026-08-10
- 関連: ADR-0010、ADR-0012、ADR-0013

## 文脈

Formaの価値は、要求仕様からDesign Foundation、Component Harness、Product Contract、Integrated Mockをagentが
生成し、人間が理解・比較・承認できることにある。deterministic mockだけではlifecycleを検証できても、実際の要求から
candidateを著述するproductにはならない。一方で、特定model、agent製品、画像生成tool、credential、host commandを
domain contractやDesign Seed Packageへ固定すると、provider変更とpackage再利用が困難になる。

screenやcomponentが画像、illustration、icon等を必要とする場合、pathだけを生成するとsource、license、purpose、
requirement trace、生成主体を監査できない。provider routingとvisual assetをfile単位のprovenanceへ統合する必要がある。

## 決定

Forma applicationはstage責務ごとの小さなauthoring portを所有する。

- Requirements Framer
- Foundation Author
- Component Author
- API Contract Designer
- Integrated Mock Author
- Visual Asset Generator

provider adapterはこれらのportを実装する。Design Requestはproviderを指定せず、運用側のversion固定された
`AuthoringProfile`がstage／artifact roleをadapterへrouteする。profileはID、revision、digest、required capability、
fallback policyを持つが、credential、host path、任意commandを含めない。

- implicit fallbackと同一fileへの複数writerを禁止する。
- unsupported route、provider unavailable、schema-invalid、trace-broken、source mutationをfail closedにする。
- deterministic mock adapterとproduction adapterは同じport conformance suiteを通す。
- production v0は少なくとも一つのreal text／code authoring routeでend-to-end生成を完走する。
- provider固有SDK型、model response、tool call recordをdomain modelにしない。

Design Seed Packageの生成payloadはfileごとにexactly one author invocationへtraceする。package manifestは
invocationをkeyed collectionとして保持し、各generated fileはinvocation keyを参照する。invocationは少なくとも次を
監査可能にする。

- provider role、tool／model identity、optional orchestrator
- AuthoringProfile revision／digest
- input snapshot digest、instruction digest
- output file path／digest

prompt本文、secret、credential、private tool transcriptはpackageへ含めない。

visual assetはoptionalなfirst-class payloadとする。`assets/catalog.json`はasset ID、kind、path、media type、dimensions、
source kind、license／usage status、purpose、requirement／element trace、invocation keyを持つ。実binaryは
`public/assets/`へ置き、他のpayload fileと同じmanifest digest検証を受ける。license／usage statusが不明なassetは
exportをfail closedにする。

特定provider名を公開contractのrequired enum、package layout、task dependencyへ入れない。provider固有のlive adapter、
評価、credential設定はadapter実装とdeployment configurationで扱う。

## 帰結

- deterministic lifecycle検証とproduction authoringを同じapplication境界で置換できる。
- text、code、imageを異なるproviderが生成しても、fileごとのauthoritative writerとlineageを一意にできる。
- package利用者はprovider SDKなしでpayload、license status、purpose、traceを検証できる。
- Formaにはprofile store、route validation、invocation provenance、source-mutation detection、real-provider E2Eが必要になる。
- provider品質、cost、latency、model selectionはoperational policyであり、Design Seed Package formatとは別versionになる。

## 参照

- [ADR-0012: Design Seed Package](ADR-0012-executable-design-seed-package.md)
- [Design Seed Package specification](../DESIGN_SEED_PACKAGE.md)
