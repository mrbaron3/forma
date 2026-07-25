# ADR-0003: Human Design Decisionをrevision digestへ束縛する

- 状態: 採択
- 日付: 2026-07-25

## 文脈

schema-validな設計は、プロダクトとして正しい設計を意味しない。人間が目的、労力、視認性、情報配置、
Design System変更、Backend Capability要求を理解して判断できる必要がある。

## 決定

- UIを含むDesign RevisionはHuman Decisionなしに`approved`にならない。
- verdictは`approve | request-changes | reject`。
- decisionはrevision ID、bundle digest、actor、time、rationaleを持つ。
- 新revisionへ旧decisionを継承しない。
- request changesは元revisionを改変せず、feedbackを次revisionの入力とする。
- この判断はHOW介入計器ではなく、明示的なproduct／experience authorityとして扱う。

## 帰結

- Review UIとrevision diffがcritical pathになる。
- 人間不在でUI実装を自動開始できない。
- 将来reuse-only changeをpolicyで自動承認する場合も、別ADRと監査可能なpolicy revisionが必要になる。

