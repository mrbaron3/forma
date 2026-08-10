# ADR-0012: 実行可能なDesign Seed Packageを主成果物とする

- 状態: Accepted
- 日付: 2026-08-10
- 置換関係: ADR-0002の配布単位を具体化し、ADR-0005のmock-firstを段階型へ拡張する

## 文脈

従来計画はExperience Contract、Design System Delta、Capability Requirements、preview等のJSON artifactを
Design Bundleへ集約することを中心にしていた。この形は検証と監査には適する一方、利用者が最初に知りたい
「どのようなデザインになり、実装開始時に何をrepositoryへ置けばよいか」が副次的になっていた。

新サービスの基盤を設計する場合、tokenやcomponentが存在しないまま画面mockを先に作ると、画面ごとに値や
部品が分岐する。逆に抽象契約だけを先に承認しても、実際のcomponent state、画面、interactionで成立するかを
判断できない。生成順と人間reviewを依存関係に沿って段階化する必要がある。

## 決定

Formaの主成果物を、展開後に単独でbuild、preview、testでき、そのまま新しいtarget repositoryの初期treeに
できる**Design Seed Package**とする。ZIPは配布transportであり、正本はpackage manifestが列挙するpayload file treeで
ある。抽象JSON artifactやreview projectionは、このfile treeを説明・検証・承認する補助contractとする。

生成とreviewを次のstageに分ける。

1. **Requirements Framing** — purpose、利用者、主要flow、成功条件、制約、対象外を固定する。
2. **Design Foundation** — `DESIGN.md`、design token、rule、design decisionを生成する。
3. **Component Harness** — component contract、実component、全stateのstory、a11y／interaction testを生成する。
4. **Product Contract** — 画面interactionからcapabilityとUI-facing OpenAPIを定義する。
5. **Integrated Mock** — OpenAPIから生成したclient／mockとcomponent harnessを使い、主要画面とscenarioを実装する。
6. **Package Approval / Export** — browserで実行したpayloadをmanifestへ固定し、detached approval receiptと共に
   ZIPとして出力する。

Requirements Framing、Design Foundation、Component Harness、Product Contract、Integrated Mockは個別のimmutable
stage revisionを持つ。後段revisionは入力にした前段digestを記録する。前段が変わった場合、そのdigestを参照する
後段decisionはstaleになる。後段だけの変更で前段のdecisionを無効にしない。

reviewで実行したpayloadを承認後に再生成してはならない。exportは承認対象workspaceのpath、media type、content
digest、roleをcanonical manifestへ固定する。approvalはmanifest内へ埋め込まず、manifest digestを参照するdetached
receiptとして記録し、manifestが指す同じpayload bytesと共にarchiveする。ZIP timestamp、entry order、compression差に
approvalを束縛しない。

Design Seed Packageは少なくとも次を含む。

- agent向けmapと作業完了条件
- design intent、brand／UX principle、copy policy
- version固定したDTCG Format Module profileのtoken
- component variant／state／a11y contract
- reusable componentとstory
- design rule、decision、例外
- UI-facing OpenAPI、参照JSON Schema、example、scenario
- OpenAPIから再生成可能なTypeScript client／mock boundary
- source／license／purpose／trace／invocationを持つoptional visual asset
- 主要screen／flowの実行可能mock
- static、interaction、accessibility、visual test
- package provenance、stage digest、toolchain／lockfile

詳細なdirectory、stage gate、manifest要件は
[Design Seed Package](../DESIGN_SEED_PACKAGE.md)を正本とする。

## 帰結

- 人間は抽象JSONではなく、実際にrepositoryへ渡す成果物をbrowserで確認できる。
- token→component→screenの依存順を守り、screen単位のdesign driftを早期に防げる。
- coding agentは説明文だけでなく、再利用可能component、rule、test、mockを初期repositoryとして受け取れる。
- content-addressingとdigest-bound approvalはfile treeへ適用され、ZIP形式には依存しない。
- Formaはtemplate toolchain、sandbox build、preview server、package exportの責務を持つ。
- package formatと生成templateを別versionとして管理し、target projectのruntime選択と混同しない必要がある。

## 参照

- [ADR-0002: content-addressed Design Bundle](ADR-0002-content-addressed-design-bundle.md)
- [ADR-0003: Human Design Decision](ADR-0003-human-design-authority.md)
- [ADR-0005: mock-first hero scenario](ADR-0005-hero-scenario-mock-first-preview.md)
- [デザインハーネスまとめ](https://zenn.dev/012/scraps/0a19814b00d4e4)
- [Design Tokens Format Module](https://tr.designtokens.org/format/)
- [ADR-0014: provider-neutral authoring](ADR-0014-provider-neutral-authoring-and-asset-provenance.md)
