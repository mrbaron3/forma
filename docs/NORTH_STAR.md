# North Star

人間が新しいproductの要求仕様を示したとき、Formaはdesign intent、token、component、UI-facing API、主要画面mock、
rule、testを依存順に生成する。人間は途中成果物と統合mockをbrowserで確認し、承認したpayload file treeを
Design Seed Packageとして受け取る。packageは単独でbuild／preview／testでき、そのまま新しいrepositoryの
初期状態としてcoding agentと開発者が利用できる。

## Hero scenario

主たる利用は、新サービス着手時に要求仕様から一度まとめて設計基盤と主要画面を作ることである。

```text
要求仕様
  → Purpose / Flow
  → Design Foundation
  → Component Harness
  → UI-facing OpenAPI
  → Integrated Mock
  → Browser Review
  → Approved ZIP
  → Target Repository
```

人間は細かなtoken、component、screen、OpenAPIを手で著述しない。agentがcandidateを作り、人間は段階ごとに
理解、比較、approve／request-changes／rejectする。各stageの第一確認面は、そのstageの実行可能なvisual projection
とdiffである。最終統合面のmockは事前に承認されたtoken、component contract、OpenAPI、scenarioから構成し、
手書きの値やdummy dataでcontractを迂回しない。

## 主成果物

主成果物は抽象的なJSON Bundleやpreview HTMLではなく、次を含む実行可能な
[Design Seed Package](DESIGN_SEED_PACKAGE.md)である。

- `AGENTS.md`と`DESIGN.md`
- version固定したDTCG Format Module profileのdesign token
- component variant／state／a11y contract
- reusable componentと全stateのstory
- design rule、decision、例外
- UI-facing target OpenAPI、参照JSON Schema、example、scenario
- source／license／purpose／trace／invocationを持つoptional visual asset
- OpenAPIから生成したclient／mock boundary
- 主要screen／flowのmock
- static、interaction、accessibility、visual test
- stage revisionとpayload file digestを持つpackage manifest
- manifest digestへ束縛したdetached approval receipt

ZIPはfile treeを渡すtransportであり、approvalはZIP bytesではなくcanonical package manifest digestへ束縛する。
reviewに使用したpayloadを承認後に再生成せず、同じfile bytesとdetached approval receiptをarchiveする。

## 守る価値

1. **Design Foundation First** — tokenとdesign principleをcomponentより先に、component contractをscreenより先に
   固定する。
2. **Executable Evidence** — proseやschemaだけでなく、実component、story、mock、testで設計が成立することを示す。
3. **Purpose–Effort–Visibility** — page、flow、elementを目的、労力、attentionへtraceする。
4. **Contracted Interaction** — UI stateをUI-facing OpenAPIのsuccess／failure semanticsへ対応付ける。
5. **Human Authority** — 人間はstage revisionとpackage manifest digestへ判断を束縛する。
6. **Same-tree Review** — browserで確認したfile treeとexportするfile treeを同一にする。
7. **Repository Handoff** — export後はtarget repositoryを唯一のwriterとし、Formaやintegratorによる
   dual-writeを行わない。
8. **Independent Product** — Formaも出力packageも、特定consumer、agent provider、DB、Git hostなしで利用できる。
9. **Provider-neutral Authorship** — provider選択を運用profileへ隔離し、全generated fileを一つのinvocationへtraceする。

## 成功の定義

- 要求仕様からDesign Foundation→Component Harness→Product Contract→Integrated Mockを順に生成できる。
- reviewerがtoken、component state、画面scenario、interactionとAPIの対応、revision diffをraw JSONなしで確認できる。
- success、loading、empty、validation、permission、failure、slow response等をbrowserで切り替えられる。
- screenがsemantic token、package component、OpenAPI生成client／mockだけを使っていることを自動検証できる。
- 承認時のpayloadとexport ZIP内payloadのfile digest集合が完全一致する。
- ZIPを展開して標準commandだけでapplication、component harness、testを実行できる。
- target repository化後、integratorはpackage内OpenAPIを別contractへ複製せず実装に利用できる。
- UI-facing OpenAPIのmaterial changeが既存design approvalを暗黙に再利用しない。

## 反証サイン

- tokenやcomponentを固定する前に画面ごとのCSS／部品が生成される。
- previewがexport packageとは別のHTMLや別buildから作られる。
- screenがhandwritten fixtureやdirect fetchでOpenAPIを迂回する。
- Storybookにはhappy pathしかなく、disabled、loading、focus、error等を確認できない。
- OpenAPIがmock承認後に初めて作られ、UI stateとfailure semanticsが一致しない。
- ZIPを展開してもFormaなしではbuild／preview／testできない。
- Formaとintegratorが同じtarget OpenAPIのcopyをそれぞれ更新する。
- JSONを直接読まないと承認対象と変更差分を理解できない。
