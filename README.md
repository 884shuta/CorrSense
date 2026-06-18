# CorrSense

CorrSense は、散布図上の点を動かしながら相関係数 `r` の感覚を直感的に学べる React + Vite の学習アプリです。
[Webサイトはこちらへ](https://884shuta.github.io/CorrSense/)

## 開発コマンド

```bash
npm install
npm run dev
npm run lint
npm run build
```

## GitHub Pages（main / root）公開時の注意

- このリポジトリは `main / root` 配信に対応するため、`index.html` から `./dist/assets/` のビルド済みファイルを参照します。
- アプリ本体を更新した場合は `npm run build` を実行し、`dist/` の変更もあわせてコミットしてください。

## 主な機能

- 点群のランダム生成 / 手動追加 / ドラッグ移動 / 削除
- 点数スライダーによる即時調整
- ピアソン相関係数 `r` のリアルタイム計算とゲージ表示
- 相関パターンのプリセット（正負・無相関・外れ値・曲線関係）
- 相関係数を予想するクイズモード（予想値との差分表示）
- 学習用の要点解説（相関と因果、外れ値、曲線関係）
