# ADR-0007: MCPはcore contractにせず、DF-008後のoptional authoring adapterとする

- Status: Accepted
- Date: 2026-07-31
- 関連: [ARCHITECTURE](../ARCHITECTURE.md)（Public ports）、[ROADMAP](../ROADMAP.md) Phase 4、
  [ADR-0001](ADR-0001-standalone-repository-and-open-contract.md)、
  [ADR-0002](ADR-0002-content-addressed-design-bundle.md)、
  [ADR-0005](ADR-0005-hero-scenario-mock-first-preview.md)、
  [DF-008 #6](https://github.com/mrbaron3/designflow/issues/6)

## Context

「DesignflowをMCPサーバー化してconsumer（mrbaron3/workflow）から呼ばせる」案が出た。
ARCHITECTUREは既に「Webhook／MCP／GitHub Appはoptional adapterであり、core contractではない」と
述べているが、では**どこで使い、どこで使わないのか**、いつ作るのかが決まっていなかった。

判断材料は次のとおり。

- consumer側の統合はLLMではなく決定論コードである。workflowのconsumer実装は型付きprovider portで、
  schema検証・digest束縛・capability reconciliationを決定論的に行う。MCPの価値は「モデルがtoolを
  発見して呼べること」だが、この経路に発見の余地は無い。
- consumerのrunnerはhost port／socketを持たず、egressはallowlist proxy、credentialはrole別に
  分離されている。MCPをstdioで入れればDesignflowのbinaryをuntrustedなrepository内容と同居する
  sandboxへ置くことになり、HTTPで入れれば認証とallowlistを要する別endpointが増える。CLI／HTTP
  portで足りるものに攻撃面を足すことになる。
- Phase 4のexitは「CLIとHTTPが同じrequest／revision／digest／decision semanticsを持つ」こと。
  第3の面を足すとconformanceの対象が増える。
- MCPは結局CLI／HTTP（DF-008）の薄いfaçadeである。中身より先にfaçadeを作ることになる。
- 一方、人間とagentが対話的に設計・レビューする面（ADR-0005のhero scenario）では、
  「提案する／差分を見る／承認を記録する」をtoolとして呼べることに素直な価値がある。

## Decision

1. **consumer統合にMCPを使わない。** consumerは公開contractとCLI／HTTP port経由の型付きportで
   統合する。MCPをconsumer統合の前提にしない。
2. **MCPはoptional adapterとして、DF-008（CLI／HTTP distribution parity）完了後に検討する。**
   目的は人間／agentの対話的な著述・レビュー面であって、consumer統合ではない。
3. **MCPを作る場合、service portの機械的な射影に限る。** 独自の意味論を持たせず、CLI／HTTPと
   同じconformance fixtureで縛る。第3のsemanticsにしない。
4. **MCPのtoolはbundle本体を返さず参照を返す。** `revisionId`、`bundleDigest`、preview参照を返し、
   数百KBのJSONをmodelのcontextへ流さない。digest検証は決定論側の責務であり、tool応答の内容を
   信頼の根拠にしない。
5. **承認の記録だけは書込みになる。** その経路もHuman Design Decisionのrevision／digest束縛
   （ADR-0002／ADR-0003）を崩さない。actor・time・revision・digest・rationaleの監査可能性を
   MCP経由でも維持する。

## Consequences

- DF-008のexitは変わらない。MCPはPhase 4のexit条件に含めない。
- consumer（workflow）側のlive adapterは既存portへの後続追加のままでよく、この判断で作業は増えない。
- 将来MCPを追加する場合、新しい公開面が増えるためcontract releaseの扱い（新RC tag）と
  conformance fixtureの共有が必要になる。その時点でADRを追補する。
- 「なぜMCPにしなかったか」を再検討する者がこのADRに到達できる。
