# ADR-0015: approval baselineのdrift検出をseed同梱checkとして引き渡す

- 状態: Accepted
- 日付: 2026-08-18
- 関連: ADR-0001、ADR-0012、ADR-0013

## 文脈

seed commit以後、target repositoryがfile treeとTarget Product API contract setの唯一のwriterになり、integratorは
変更を同じrepositoryへのPRとして行う（ADR-0013）。一方で同梱する`forma.package.json`と`forma.approval.json`は
初期承認baselineの履歴であり、現在commitも承認済みに見せるために書き換えてはならない（ADR-0012）。

したがってseed後のtarget repositoryでは、承認済みbaselineと現在commitの間にdriftが必ず生じる。Roadmap Phase R5は
このdriftを旧approvalのstale状態として検出することをexit criteriaに含めるが、検出主体と実行場所を定めていない。

Formaはconsumer repositoryを所有せず継続writeしない。integratorはForma、manifest format、receipt semanticsを
知らないまま実装できることをintegration成立条件にしている。両方を守ったまま検出主体を決めなければ、「承認済み」と
表示されるfile treeが誰にも検査されないまま変化する。

## 決定

baseline driftの検出は、Design Seed Packageが同梱するcheckとしてtarget repositoryが所有する。

seed templateは次を出力に含める。

- baseline manifestと現在のpayload file digestを比較し、差分を分類して報告するcheck command
- それを実行するrepository CI workflow
- 上記をForma runtime、network access、credentialなしで実行できるtoolchain固定

checkは差分を次の3種類へ分類する。

| 分類 | 対象 | 扱い |
|---|---|---|
| generated差分 | 手編集禁止のgenerated directory | failure。source contractからの再生成で解消する |
| approved payload差分 | baselineが承認したdesign／api／component payload | stale報告。継続開発を止めない |
| baseline外追加 | seed後に追加したfile | 情報。承認対象ではない |

checkはmanifestとreceiptを書き換えない。再承認は特定commitをsource snapshotとしてimportする新しいForma revision
であり、このcheckの責務ではない。

integratorはこのcheckをrepositoryのrequired checkとして実行するだけでよく、Forma、manifest format、receipt
semanticsを理解しない。checkの存在と結果はtarget repository内で完結する。

### 採用しない案

- **integratorへdrift検出を実装する** — integratorがForma固有のmanifest／receipt semanticsへ依存し、integratorごとに
  同じ検出を再実装することになる。Formaと出力packageが特定consumerなしで利用できるという独立性（ADR-0001）と、
  integrator側にForma参照が無くてもhandoffが成立するという条件に反する。
- **Formaがtarget repositoryを監視する** — Formaがconsumer repositoryを所有しないという境界に反し、Forma workspaceと
  target repositoryのdual-writeへの入口になる。
- **検出しない** — R5 exit criteriaを満たさず、承認済みと表示されるbaselineが無検査で陳腐化する。

## 帰結

- target repositoryはForma runtimeなしで自身のdriftを検査でき、R5 exitの「Forma runtimeなしでbuild／preview／test
  できる」と同じ前提で動く。
- integratorはrequired checkを踏むだけでよく、Formaへの参照を持たない。
- seed templateはcheck実装とCI workflowを出力対象に含め、package format versionへ紐づける。
- 分類規則を誤るとapproved payload差分がfailureとなり継続開発を止めるため、3分類の判定をconformance suiteで固定
  する必要がある。
- 再承認pathは従来どおりForma側に残り、target repositoryからForma workspaceへの書き戻しは発生しない。

## 参照

- [ADR-0012: 実行可能なDesign Seed Package](ADR-0012-executable-design-seed-package.md)
- [ADR-0013: UI-facing target OpenAPIをFormaの出力契約とする](ADR-0013-forma-owned-target-openapi.md)
- [Design Seed Package](../DESIGN_SEED_PACKAGE.md)
- [Roadmap Phase R5](../ROADMAP.md)
