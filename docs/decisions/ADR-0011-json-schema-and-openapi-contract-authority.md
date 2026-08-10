# ADR-0011: JSON SchemaとOpenAPIの契約責務を分離する

- 状態: Accepted（Target Product APIの所有とhandoffはADR-0013で具体化）
- 日付: 2026-08-10

## 文脈

Formaの公開境界には、Design RequestやDesign RevisionのようにHTTP以外でも保存・交換するartifactと、
HTTP endpoint固有のmethod、path、status、header、securityがある。すべてをOpenAPIへ埋め込むとartifactが
HTTP transportに従属し、JSON SchemaとOpenAPIへ同じshapeを手書きすると二重の正本が生まれる。

TypeSpec等のIDLから両方を生成する案もあるが、Formaでは公開JSON Schemaそのものの閉性、union、format、
canonicalizationとの関係を精密に管理する必要がある。生成器を追加の契約解釈層にせず、公開成果物を直接
reviewできる状態を優先する。

## 決定

契約を次の権威に分ける。

| 対象 | 正本 | 所有する内容 |
|---|---|---|
| domain artifact | JSON Schema Draft 2020-12 | 保存・交換するJSONのshapeと値制約 |
| application operation | JSON Schema Draft 2020-12 | transport-neutralなinput、result、domain error |
| HTTP transport | OpenAPI 3.1系 | path、method、status、header、security、media type |
| cross-artifact／behavior | conformance vector | 参照整合、digest、状態遷移、冪等性、副作用 |
| 人間向け意味・理由 | ADR／contract document | schemaだけでは表せないsemantic invariant |

JSON bodyのshapeはJSON Schemaだけで定義する。OpenAPIは外部JSON Schemaを`$ref`し、同じschemaを
`components.schemas`へ手書きで複製しない。配布やcode generationに単一fileが必要な場合はbundleを生成して
よいが、bundleは編集禁止の派生成果物とする。

### 適用範囲

この責務分離は、Forma Service APIと各Design Seed PackageのTarget Product APIへ個別に適用する。両者は同じ
authoring profileとtoolchainを利用できるが、schema、OpenAPI document、release、version、authoritative writerを
共有しない。Target Product APIのlifecycleとrepository handoffはADR-0013に従う。

初期transport profileはOpenAPI 3.1系に固定する。新しいminorを自動追従せず、選定したlinter、bundler、validator、
TypeScript generator、mock generatorが外部JSON Schema参照を含む同一conformance suiteを通った時点でADRを更新する。
profileのpatch versionとtoolchain versionはcontract／template releaseごとに固定する。

### JSON Schema profile

- dialectはDraft 2020-12とし、各root schemaに`$schema`を明記する。
- 公開objectは意図せずfieldを受け入れない。compositionを考慮して`additionalProperties`または
  `unevaluatedProperties`を明示する。
- `date-time`、`uri`等の`format`はannotationだけでなくassertionとして検証する。
- 初期versionではcustom vocabulary／custom keywordを公開契約に導入しない。
- release validation中のnetwork参照を禁止し、すべての`$ref`をrelease bundle内で解決可能にする。
- schemaだけで表せない規則を非標準keywordへ押し込まず、positive／negative conformance vectorにする。

### Runtime typeとの境界

- Goのdomain typeは手書きし、生成されたHTTP／schema DTOをdomain modelとして使わない。
- Go adapterは公開JSONをschema検証した後、application command／queryへ明示的にmappingする。
- Go server code generationは必須にしない。導入する場合も`internal/generated`に限定する。
- frontendのTypeScript型とfetch clientはOpenAPIから生成し、生成物を手編集しない。
- React featureは生成されたtransport型を必要以上に伝播させず、表示固有modelが必要なら境界で変換する。

### Errorとversion

- domain errorはtransport-neutralな安定`errorCode`とmachine-readable detailを持つ。
- HTTP adapterはdomain errorをRFC 9457 Problem DetailsとHTTP statusへmappingする。
- CLI adapterは同じdomain errorをJSONとexit codeへmappingする。
- API version、contract release、個々のartifact schema versionを同一概念にしない。
- 公開済み`contract-v1.0.0-rc.*`を変更せず、全面再実装の契約は新しいmajorまたは公開前の`next`で作る。
- 新実装はv1 compatibility adapterを持たない。

### 採用しない案

- OpenAPIだけを正本にする案: HTTPを使わないbundle／CLI contractまでtransportに従属するため採用しない。
- JSON Schemaだけを正本にする案: HTTP method、status、securityを正確に表せないため採用しない。
- TypeSpecをauthoring sourceにする案: 現時点では生成層の追加に見合う複数protocol／多数SDKの重複がないため
  採用しない。必要性が実測できた場合に再検討する。
- Protocol Buffersを公開artifactの正本にする案: canonical JSON bundleと異なるserialization semanticsを
  持ち込むため採用しない。

## 帰結

- Go、TypeScript、CLI、外部consumerが同じlanguage-neutral artifact contractを利用できる。
- HTTPを追加・変更してもdomain artifactの正本は変わらない。
- JSON bodyの二重定義を避けながら、OpenAPI client generationとAPI documentationを利用できる。
- schema validationだけで完了とせず、digest、approval invalidation、CLI／HTTP parityの実行テストが必要になる。
- contract compiler、schema validator、OpenAPI bundler、TypeScript generatorのversion固定と再生成差分確認が必要になる。

## 参照

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [OpenAPI Specification](https://spec.openapis.org/oas/)
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [TypeSpec emitters](https://typespec.io/docs/extending-typespec/emitters-basics/)
