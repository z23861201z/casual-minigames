# Casual Minigames

纯静态精品休闲小游戏合集（零构建 · 可直接打开 · 可静态部署）。

## 游戏

| 游戏 | 路径 | 简介 |
|------|------|------|
| **消灭同色方块** | [`games/samegame/`](games/samegame/) | SameGame：连通同色消除、重力与空列压缩、连击与关卡 |
| **数字门跑酷** | [`games/number-gate/`](games/number-gate/) | Number Gate Runner：三车道选门改写力量、打怪结算、战役+无尽 |

合集首页：[`index.html`](index.html)

## 本地打开

无需安装依赖：

```bash
# 方式 A：直接用浏览器打开
open index.html

# 方式 B：任意静态服务器（推荐，避免个别浏览器 file:// 限制）
npx --yes serve .
# 或: python3 -m http.server 8080
```

然后访问首页，或直接打开：

- `games/samegame/index.html`
- `games/number-gate/index.html`

## 数字门跑酷 · 玩法与控制

- **自动前进**，用左右选择车道撞入数字门（`+N` / `×N` / `-N` / `÷N` / 炸弹 / 护盾 / 分数倍率）
- **力量**决定能否击杀前方怪物；护盾可挡一次伤害或炸弹
- **战役** 12 关 + **无尽** 模式

控制：

- 键盘：`←` / `A` 左，`→` / `D` 右，`P` / `Esc` 暂停，空格开始
- 触控：左右滑动，或点屏幕两侧圆形按钮

## 部署

整仓丢到 GitHub Pages / Cloudflare Pages / Netlify / 任意静态托管即可，**无需 build**。

Pages 入口设为仓库根目录（`index.html`）。

## 自测

```bash
node games/number-gate/tests/core-test.js
```

详见 `games/number-gate/SELFTEST.md`。

## 设计文档（仓库外副本）

开发阶段文档可能位于工作区：

- `number-gate-phase1-research.md`
- `number-gate-GDD.md`

本仓库内已包含可玩实现与 `games/number-gate/data/levels.json`。

## License

代码以可自由使用为目的提供；第三方参考仓库仅作调研，未复制其素材。
