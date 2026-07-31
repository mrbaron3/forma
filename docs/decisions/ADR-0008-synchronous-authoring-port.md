# ADR-0008: 同期artifact単位のAuthoringBackend port

- 状態: Accepted
- 日付: 2026-07-31

## 決定

著述境界は `authorExperience`、`authorDesignSystemDelta`、`deriveCapabilities` の同期operationとする。
共通入力は固定された `AuthoringContextSnapshot` 値とし、`deriveCapabilities` だけは
interaction traceの正本となる `ExperienceContract` も明示的に受け取る。各operationは成功または
閉じた失敗kindを返す。
provider provenance は成果物から分離し、bundle manifestの `authorInvocationRefs` で
`invocationKey` をkeyとするclosed objectとして対応付ける。objectは1件以上を必須とし、
value側にkeyを重複保持しないため、同じ `invocationKey` の複数recordは表現できない。
失敗の `detail` はkindごとのdiscriminated unionとし、snapshotはschema検証後に内容からdigestを
再計算してprovenance recordへ束縛する。

## 理由

artifactごとのschema、trace、provenance検証をrevision生成前にfail closedにできる。repository、
consumer DB、provider runtimeを公開境界に含めず、同じ入力を決定論的mockで再現できる。

## 帰結

materialな出力変更は新しいdigestとなる。失敗結果や部分artifactからrevisionを生成してはならない。
