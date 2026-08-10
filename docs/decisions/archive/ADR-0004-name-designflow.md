# ADR-0004: 製品名とrepository名をDesignflowへ統一する

- 状態: Superseded — [ADR-0009](../ADR-0009-name-forma.md)が製品名をFormaへ変更（2026-08-01）
- 日付: 2026-07-25

## 文脈

`experience-contract`は内部artifact名と製品名が同じで、何をするrepositoryか判別しにくい。
製品はExperience Contractだけでなく、Design Request、Design System Delta、Capability Requirements、
Preview、Human Decision、Conformanceを所有する。

## 決定

- 製品名を`Designflow`、repositoryとCLI名を`designflow`とする。
- 公開schema namespaceを`urn:designflow:schema:*`とする。
- `ExperienceContract`はDesign Bundle内のartifact名として維持する。
- task keyは`DF-NNN`とする。

## 帰結

- 製品、repository、CLI、schema namespaceを同じ短い名称で識別できる。
- Experience Contractというdomain artifactの意味は失わない。
- v1公開前の変更なので旧namespace互換adapterは作らない。
