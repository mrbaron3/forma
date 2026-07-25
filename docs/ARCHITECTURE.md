# Architecture

## System boundary

Designflowは、Design Requestを受け、設計を著述・検証・preview化し、人間判断を経て
Approved Design Bundleを公開する独立systemである。

```text
Consumer
  │ DesignRequest v1
  ▼
Request Intake
  → Experience Authoring
  → Design System Governance
  → Capability Requirement Derivation
  → Revision Assembly / Validation
  → Preview Rendering
  → Human Review
  → Approved Design Bundle
  │
  └─ status/event/bundle reference → Consumer
```

## Bounded contexts

### Request Intake

汎用`DesignRequest`を検証し、source revisionとrequirement identityを版固定する。GitHub Issue、
task record、手入力brief等のprovider差はadapterが吸収する。

### Experience Authoring

Page Purpose、User Task、Flow、Effort Budget、Attention Hierarchy、Region、Element、Placement Rationale、
accessibility requirementを所有する。

### Design System Governance

Design System snapshotとdelta、token／component／pattern decisionを所有する。feature artifact内への
共有system複製を禁止し、参照またはdeltaとして表現する。

### Capability Requirements

interactionからbackendが提供すべき能力を導出する。具体API設計はconsumer側または別systemの責務。

### Revision Assembly

全artifactを検証し、content digestを計算してimmutable Design Revisionを作る。material changeは必ず
新revisionとなる。

### Human Review

Preview、trace、diffを提示し、Human Design Decisionを記録する。承認はrevision／bundle digestに限定する。

### Conformance

実装artifactをApproved Bundleへ照合し、state coverage、token drift、component contract、
accessibility、visual evidence、capability contractの差を報告する。

## Public ports

### Contract port

- `DesignRequest v1`
- `DesignBundleManifest v1`
- `ExperienceContract v1`
- `DesignSystemDelta v1`
- `CapabilityRequirements v1`
- `HumanDesignDecision v1`

正本は`contracts/v1/*.schema.json`。特定言語の型はそこから生成またはconformする。

### Local CLI port

目標形:

```text
designflow propose --request request.json
designflow serve
designflow status <request-id>
designflow decide <revision-id> --verdict ...
designflow export <revision-id>
designflow verify --bundle ... --implementation ...
```

### Service port

目標形:

```text
POST /v1/design-requests
GET  /v1/design-requests/{requestId}
GET  /v1/design-revisions/{revisionId}
GET  /v1/design-revisions/{revisionId}/bundle
POST /v1/design-revisions/{revisionId}/decisions
```

Webhook／MCP／GitHub Appはoptional adapterであり、core contractではない。

## State ownership

Engineが所有:

- DesignRequest
- DesignRevision
- DesignSystemSnapshot／Delta
- PreviewArtifact
- HumanDesignDecision

Consumerが所有:

- product backlog
- Issue／PR
- implementation state
- deployment／release
- concrete API／DB設計

Consumerは`provider, requestId, revisionId, bundleDigest, status, reviewUrl`だけを投影する。内部DB共有、
consumer DBへのdual-write、consumer lifecycle enumの流入は禁止する。

## Deployment independence

最初はlocal file／SQLite相当の単体modeを成立させ、その上にservice storeを追加する。storage、
agent provider、preview renderer、source providerはport化する。runtime言語はこの境界を満たす実装詳細であり、
contract-first milestone完了前に固定しない。

## Security

- Source textはuntrusted product dataとして扱う。
- authoring agentは明示されたcontextとartifact output以外へ書き込まない。
- Previewはuntrusted scriptを実行しない隔離境界でrenderする。
- Human Decisionのactor、time、revision、digest、rationaleを監査可能にする。
- credential、host path、shell commandをDesign Requestから注入できない。
