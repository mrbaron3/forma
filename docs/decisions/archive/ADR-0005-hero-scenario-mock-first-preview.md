# ADR-0005: 利用想定をhero scenario（一括基盤設計・モック先行preview）として固定する

- Status: Superseded — [ADR-0012](../ADR-0012-executable-design-seed-package.md)がmock-firstを段階型stage modelへ拡張（2026-08-10）
- Date: 2026-07-30
- 関連: [Issue #11](https://github.com/mrbaron3/designflow/issues/11)、
  [NORTH_STAR](../../NORTH_STAR.md)、[ROADMAP](../../ROADMAP.md)

## Context

所有者との突き合わせ（mrbaron3/workflow#44 のdogfood目的整理）で、現行docの力点と実際に求められて
いる第一価値に差分があることを確認した。

- 現行docはfeatureごとの常設設計ゲートを前提とし、governance artifactを等価の重みで扱っていた。
- 所有者の利用想定は「新サービスを作るときに必要となる基盤を一度まとめて設計する」単発バッチで
  あり、第一に欲しい出力は「モック状態でよいので、どのようなデザインになるかが見えること」。
- 人間の席は承認者（approve、または具体的な要望・やり方の指示を添えたrequest-changes）であり、
  人間は自分では描かない。

## Decision

1. hero scenarioを「新サービス着手時にDesign System基盤（token／component）＋主要画面のモック一式を
   一括設計し、人間がモックpreviewを第一確認面として承認する」に固定する。
2. Phase 2のpreview要件を「視覚モックとして成立するsafe HTML preview」へ引き上げる。annotated
   wireframeは補助表示であり、単独ではPhase 2 exitを満たさない。
3. governance artifact（Effort Budget・全要素Placement Rationale・Attention Hierarchy・Capability
   Requirements）は`contract-v1.0.0-rc.1`のrequiredを維持したままauthoring agentが全量著述する。
   schemaは緩めず、著述の負担配分だけを人間からagentへ移す。
4. featureごとの継続利用と実装後conformance（DF-009／Phase 5）は将来scopeとして保持し、
   v0完了条件（umbrella #1）から外す。

## Consequences

- DF-004／DF-005はモックpreviewを第一確認面とするreview surfaceになる。purpose／effort／attention
  表示は残るが補助へ回る。
- DF-006→DF-007→preview rendererがheroのcritical pathになる（mrbaron3/workflow#44 の最初の実走slice
  と一致）。
- DF-010のvisual asset first-class化が契約拡張を要する場合、既存tagを書き換えず新RC tagの別Issueと
  して扱う（ADR-0001の境界を維持）。
- 契約のrequired形状は不変のため、既存consumer（fixture pin済み）への影響はない。
