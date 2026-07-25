# North Star

人間がプロダクトの意図を示したとき、実装前にユーザー体験が可視化され、目的達成までの労力、
視認性、全表示物と配置の理由、Design Systemへの影響、Backend Capabilityへの要求が同じ設計revisionに
束縛される。人間は理解可能なPreviewと差分を確認して承認または差戻しでき、承認済みrevisionだけが
開発へ渡る。

## 守る価値

1. **Purpose** — 各ページは主目的、成功状態、対象外を持つ。
2. **Effort** — ユーザーが目的へ到達するための操作・判断・記憶・待ち・復旧コストを予算化する。
3. **Visibility** — 視覚的な強さと情報優先度を一致させる。
4. **Reasoned Surface** — 全region、element、placementはtask、requirement、安全性、または明示理由へtraceする。
5. **Human Authority** — product／experience判断は人間がrevision単位で承認する。
6. **Design Before Decomposition** — UIから必要能力を導出してからfrontend／backendのIssue境界を確定する。
7. **Independent Product** — 特定の開発ハーネス、provider、デザインツール、DBへ依存しない。

## 成功の定義

- standalone CLIまたはReview UIだけでDesign Request→Proposal→Human Decision→Approved Bundleが完結する。
- 同じ入力・Design System snapshot・contract versionから、検証可能で比較可能な成果物が得られる。
- 承認後の変更は新revisionとなり、旧承認を再利用できない。
- consumerはbundle digestと公開contractだけで統合でき、engineのDBを共有しない。
- 実装後の画面をApproved Bundleへ照合し、driftを理由付きで報告できる。

## 反証サイン

- JSONを直接開かないと人間が設計を確認できない。
- tokenやcomponentがfeatureごとに複製される。
- UI実装中に初めてbackend capability不足が発覚する。
- 目的にtraceできない表示物が「一般的だから」という理由で残る。
- Design Revisionが変わっても過去の承認が有効なままになる。
- consumerがengineの内部DB schemaやruntime型をimportする。

