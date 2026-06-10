# I-Ching Hexagram Interpreter 简易易经六爻及变爻识别工具
一个支持抛币起卦、自动识别变爻，并按取用规则展示解读的易经网页工具。

## 功能

- 支持手动输入六次抛币结果。
- 支持在线随机抛硬币起卦。
- 自动生成本卦与变卦。
- 自动识别 6、9 形成的变爻。
- 根据变爻数量展示对应取用规则。
- 展示卦辞、彖辞、象辞、爻辞、小象、意象与白话解读。
- 使用纯前端实现，无需后端服务器。

## 使用方式
本项目是静态网页，只需要以下文件放在同一目录：

```text
index.html
styles.css
app.js
iching-hexagrams.json

本地预览：
python3 -m http.server 8000
然后打开：
http://127.0.0.1:8000

通用预览：
https://jingchengggg.github.io/I-Ching-hexagram-interpreter/

卦象仅供参悟，不构成任何预测或者宗教建议。
JS @2026 不为商用，仅供参考。
