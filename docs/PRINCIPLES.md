# Product Design Principles

## Foundation before screens

画面を最初のdesign primitiveにしない。生成順を次で固定する。

```text
Purpose / Flow
  → Design Principle / Token
  → Component Contract / Component State
  → UI-facing API / Scenario
  → Screen / Integrated Mock
```

screenが新しいliteral value、局所component、未契約stateを必要とする場合、screen内で例外処理せず、前段の
token、component contract、rule、decisionへ戻す。前段を変更した場合は、そのdigestを参照する後段reviewを
やり直す。

## Purpose–Effort–Visibility

### Purpose

各pageは次を明示する。

- 対象userと利用文脈
- 1つのprimary purposeと観測可能なsuccess outcome
- secondary purpose
- safety／audit上必要な目的
- out of scope

primary purposeが複数ある場合、page、route、modeの分離を検討し、同居させる場合は理由をdesign decisionへ残す。

### Effort

Effortはclick数だけでなく、action、decision、required input、context switch、memory burden、wait、recovery、
repeated entryの合計として扱う。各primary taskはEffort Budgetを持つ。安全確認、不可逆操作、権限変更等の
必要な摩擦は削らず、何を保護するための労力かを明示する。

### Visibility

PageごとにAttention Hierarchyを定義し、region／elementのprominenceを情報優先度と一致させる。detail、debug、
rare actionはprogressive disclosureを基本とする。

## Purpose → Interaction → Contract

全表示物とinteractionは次へtraceする。

```text
Requirement
  └─ Page Purpose
       └─ User Task / Flow
            └─ Region / Element
                 └─ Component Contract
                      └─ Interaction / UI State
                           └─ Capability
                                └─ OpenAPI Operation / Scenario
```

削除してもpurpose、task、安全性、理解可能性のいずれも変わらないelementは原則削除する。装飾は階層理解、
brand認識、安心感等の寄与を説明できなければならない。

## Design System contracts

正本を役割で分ける。

| 正本 | 管理するもの | 管理しないもの |
|---|---|---|
| `DESIGN.md` | brand／UX principle、user、copy policy、参照map | token値、component stateの複製 |
| `design/tokens/` | primitive／semantic tokenとalias | component behavior |
| `design/contracts/` | variant、state、constraint、a11y、token ref | token実値、長い判断理由 |
| `design/rules.json` | forbid／prefer、severity、検証方法 | 背景説明の複製 |
| `design/decisions/` | context、trade-off、例外、verification | 現在仕様の複製 |
| component harness | 実componentと全stateの実行例 | design rationaleの正本 |

componentは原則semantic tokenだけを参照する。stateは単一配列ではなくinteraction、availability、progress等の
直交軸へ分け、不正な組合せをconstraintで閉じる。component contractはrequired storyとrequired testを持つ。

## UI-facing API design

Experience Authorはconcrete endpointを決めず、interactionから必要capabilityを記述する。FormaのAPI Contract
Designerがcapabilityをtarget productのOpenAPIへ具体化する。

Formaが決めるもの:

- path、method、operation、request／response schema
- success、validation、authentication、authorization、conflict、retryable failure
- pagination、filter、sort、freshness
- idempotency、optimistic concurrency、retry、cancel
- example、mock scenario、interaction trace

Formaが決めないもの:

- database table、service decomposition
- queue、cache、cloud provider
- deployment topology、consumer内部module
- UIから使用しないinternal-only API

screenはOpenAPIから生成したclient／mock boundaryを利用する。direct fetch、schema外fixture、手書きresponse typeは
design package内で禁止する。

## Browser review

人間は段階に応じて次を確認する。

### Foundation review

- color、typography、spacing、radius、elevation、motion
- semantic tokenの用途とcontrast
- brand／UX principle、copy tone、Do／Don't

### Component review

- variantと全required state
- loading、disabled、focus-visible、error、permission、long content、narrow viewport、theme
- keyboard、accessible name、focus order、status announcement

### Integrated mock review

- 主要screen／flowとviewport
- success、loading、empty、validation、permission、failure、slow response
- selected interactionからOpenAPI operationとresponse UI stateへのtrace
- Foundation／Component／OpenAPI／screenの前revisionとの差分

raw JSON／YAMLは補助表示であり、第一review surfaceにしない。

## Approval and export

判断は`approve | request-changes | reject`とし、対象stage revisionまたはpackage manifest digest、actor、time、
rationaleへ束縛する。前段material changeは依存する後段approvalをstaleにする。後段だけの変更で、参照digestが
変わらない前段approvalを無効にしない。

reviewで実行したpayloadをapproval後に再生成してはならない。同じpayload file treeをmanifestへ固定し、manifestが
指すbytesをZIP化する。approvalはmanifest digestを参照するdetached receiptとして加える。ZIP compression差ではなく
canonical manifest digestをidentityとする。

## Repository handoff

Formaはdraft workspaceとapproved packageを所有する。ZIPを展開してrepository化した後はtarget repositoryが
唯一のwriterになる。integratorはtarget repositoryのdesign contractとOpenAPIを読み、変更を同じ
repositoryへのPRとして行う。

Formaとtarget repositoryを同期するdual-writeは行わない。再設計時は特定commitを新しいsource snapshotとして
importし、新しいstage revisionを作る。

## Review feedback as harness improvement

同じreview指摘が繰り返された場合、注意文を増やすだけで終わらせない。適切な層へ昇格する。

- 値の問題 → token
- component behavior／state漏れ → component contract、story、test
- 禁止／推奨pattern → rule、lint
- product固有trade-off → decision
- API success／failure不整合 → OpenAPI、example、scenario、contract test
- generatorの再発問題 → template、eval、conformance vector
