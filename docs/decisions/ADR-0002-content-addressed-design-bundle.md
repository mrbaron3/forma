# ADR-0002: 設計成果物をcontent-addressed Design Bundleとして配布する

- 状態: 採択
- 日付: 2026-07-25

## 文脈

Experience、token、component、capability、previewを別々のmutable recordとしてconsumerへ渡すと、
何を人間が承認し、何を実装が参照したかを再現できない。

## 決定

- 1 Design Revisionの全artifactをmanifest付きBundleへ束ねる。
- artifactごとにSHA-256、media type、schema referenceを持つ。
- canonical manifestからbundle digestを計算する。
- material changeは既存revisionを更新せず新revisionを作る。
- consumerはrevision IDとbundle digestを必ず同時に記録する。

## 帰結

- Human Decision、implementation、review evidenceを同一design revisionへ束縛できる。
- canonical serializationとartifact storageが必要になる。
- 大きいpreview artifactはmanifest参照にでき、contract本体と分離できる。

