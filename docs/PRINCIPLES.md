# Product Design Principles

## Purpose–Effort–Visibility

### Purpose

各Page Purpose Contractは次を明示する。

- 対象ユーザーと利用文脈
- 1つのprimary purpose
- 観測可能なsuccess outcome
- secondary purpose
- safety／audit上必要な目的
- out of scope

primary purposeが複数ある場合、page、route、modeの分離を検討し、同居させる場合は理由を残す。

### Effort

Effortはclick数だけでなく、次の合計として扱う。

- action count
- decision count
- required input
- context switch
- memory burden
- wait
- recovery steps
- repeated entry

各primary taskはEffort Budgetを持つ。安全確認、不可逆操作、権限変更などの必要な摩擦は削らず、
何を保護するための労力かを明示する。

### Visibility

PageごとにAttention Hierarchyを定義し、region／elementのprominenceが情報優先度と一致することを
検証する。詳細・debug情報・rare actionはprogressive disclosureを基本とする。

## Purpose → Task → Region → Element → Placement

全表示物は次のtraceを持つ。

```text
Requirement
  └─ Page Purpose
       └─ User Task
            └─ Layout Region
                 └─ UI Element
                      └─ Placement Rationale
```

要素を削除してもpurpose、task、安全性、理解可能性のいずれも変わらない場合、その要素は原則削除する。
装飾は許容するが、階層理解、ブランド認識、安心感などの寄与を説明できなければならない。

## UXとBackendの責務境界

Experience Authorは具体endpoint、table、queueを決めない。interactionから必要な能力を記述する。

- user intent
- inputとsuccess outcome
- failure semantics
- authorization
- latency／freshness
- concurrency
- idempotency
- retry／cancel
- pagination
- audit

API／Domain設計者はこのCapability Requirementを技術契約へ変換する。能力不足や矛盾が残る間は
implementation issueを確定しない。

## Design System

Design Systemへの変更は`reuse | extend | create | feature-local`のいずれかとして理由を持つ。
tokenはprimitive、semantic、componentの層を区別し、alias／group／deprecationを保持する。
交換形式はDTCG Design Tokens Format 2025.10を基準とし、独自拡張はnamespaced metadataへ閉じる。

## Human Review

人間はraw JSONではなく、次を同時に確認できる。

- annotated preview
- page purpose
- task flow
- effort budget
- attention hierarchy
- state matrix
- token／component／pattern delta
- backend capability requirements
- requirement trace
- previous revisionとの差分

判断は`approve | request-changes | reject`。判断はbundle digestへ束縛し、変更されたrevisionには継承しない。

