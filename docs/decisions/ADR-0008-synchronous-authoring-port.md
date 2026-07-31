# ADR-0008: 同期artifact単位のAuthoringBackend port

- 状態: Accepted
- 日付: 2026-07-31

## 決定

著述境界は `authorExperience`、`authorDesignSystemDelta`、`deriveCapabilities` の同期operationとする。
入力は固定された `AuthoringContextSnapshot` 値に限定し、成功または閉じた失敗kindを返す。
provider provenance は成果物から分離し、bundle manifest で `invocationKey` により対応付ける。

## 理由

artifactごとのschema、trace、provenance検証をrevision生成前にfail closedにできる。repository、
consumer DB、provider runtimeを公開境界に含めず、同じ入力を決定論的mockで再現できる。

## 帰結

materialな出力変更は新しいdigestとなる。失敗結果や部分artifactからrevisionを生成してはならない。
