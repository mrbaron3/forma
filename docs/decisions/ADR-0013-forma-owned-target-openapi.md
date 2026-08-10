# ADR-0013: UI-facing target OpenAPIをFormaの出力契約とする

- 状態: Accepted
- 日付: 2026-08-10
- 関連: ADR-0011、ADR-0012

## 文脈

画面のloading、empty、error、権限不足、pagination、retry、cancel、optimistic updateは、response shapeだけでなく
HTTP operation、status、concurrency、idempotency等のsemanticsに依存する。画面mockを承認した後に別systemが
初めてOpenAPIを作ると、承認済みinteractionが実装可能な契約へ写らない、またはAPI都合で画面状態が変わる。

一方、Experience Authorがdatabaseやservice topologyまで決めると、UX設計とbackend内部設計の責務が混ざる。
Forma自身を操作するService API、生成対象productのAPI、Servo自身のControl APIも同じ「OpenAPI」と呼ばれるため、
所有対象を分けなければならない。

## 決定

FormaはDesign Seed Packageの一部として、生成対象productの**UI-facing target OpenAPI**を具体化する。HTTP
transportの正本は`api/openapi.yaml`、JSON bodyの正本はそこから参照する`api/schemas/*.schema.json`とする。
これらは一つのProduct Contract revisionとして承認し、Integrated Mock revisionはそのdigestを入力に持つ。最終の
Package ApprovalはProduct ContractとIntegrated Mockの両digestへ束縛する。

Forma内部の著述責務を分ける。

- **Experience Author** — page、flow、interaction、状態、必要capabilityを定義し、具体endpointを決めない。
- **API Contract Designer** — approved capabilityをpath、method、request／response、status、security、pagination、
  concurrency、idempotency等のUI-facing OpenAPIへ写す。
- **Mock Builder** — OpenAPIからTypeScript client、validator、mock handler、scenarioを生成し、screenから利用する。

API Contract Designerはconsumer contractを所有するが、database table、service decomposition、queue／cache製品、
cloud provider、deployment topology、internal-only APIを決めない。

Integrated Mockは手書きのHTTP callやschema外のfixtureでOpenAPIを迂回してはならない。screenは生成clientまたは
同じoperation contractにconformするadapterを通し、success、loading、empty、validation、unauthorized、
forbidden、retryable failure、slow response等のreview対象scenarioをschema-validなexampleで実行する。

OpenAPIを次の3種類に分離する。

| Contract | 所有者 | 用途 |
|---|---|---|
| Forma Service API | Forma repository | request、stage、review、exportを操作する |
| Target Product API | Design Seed／target repository | `api/openapi.yaml`と参照schemaから成るUI／backend契約 |
| Servo Control API | Servo repository | Servo自身を操作する |

これらを参照、生成、versionのどの面でも同一contractとして扱わない。

Target Product APIのauthoritative writerはlifecycleで移る。

1. 生成・review中はForma draft workspaceがwriterである。
2. approval後はpackage manifestが指すimmutable Target Product API contract setが承認対象になる。
3. repository化後はtarget repositoryが唯一のwriterになる。
4. Servoはtarget repositoryの同じcontract setを読み、実装または変更をそのrepositoryへのPRとして行う。
5. approved operation／schemaのmaterial changeは新しいForma revisionとして再reviewする。

FormaとServoへTarget Product APIを複製してdual-writeしない。ServoとのhandoffはDesign Seed Packageのmanifest、digest、
repository revisionを介し、Servo固有fieldをtarget OpenAPIへ必須化しない。capabilityとoperationのtraceは標準
`operationId`とpackage内のtrace metadataで検証し、必要なvendor extensionはoptional annotationに限定する。

Goのdomain modelからTarget Product APIを生成しない。Target Product APIは生成対象productのcontractであり、
Forma backendのruntime typeとは無関係である。Forma Service APIについてもADR-0011のcontract-first境界を守る。

## 帰結

- 人間はUIと、それを成立させるAPI success／failure semanticsを同じreviewで判断できる。
- mock client／handler／scenarioをOpenAPIから生成し、見た目だけ成立するmockを防げる。
- Servoはcapabilityから別OpenAPIを再発明せず、target repositoryの承認済みcontractに対して実装できる。
- UI-facing contract変更はdesign approvalへtraceでき、backend内部変更はFormaのscope外に保てる。
- FormaにはOpenAPI lint、example validation、operation coverage、mock conformance、API diff projectionが必要になる。

## 参照

- [ADR-0011: JSON SchemaとOpenAPIの契約責務](ADR-0011-json-schema-and-openapi-contract-authority.md)
- [ADR-0012: Design Seed Package](ADR-0012-executable-design-seed-package.md)
- [Servo ADR-0012: external design provider](https://github.com/mrbaron3/servo/blob/main/docs/decisions/ADR-0012-external-designflow-provider.md)
