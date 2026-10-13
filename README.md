# Casual Minigames

纯静态精品休闲小游戏合集（零构建 · 可直接打开 · 可静态部署）。

## 游戏

| 游戏 | 路径 | 简介 |
|------|------|------|
| **消灭同色方块** | [`games/samegame/`](games/samegame/) | SameGame：连通同色消除、重力与空列压缩、连击与关卡 |
| **数字门 · 武器僵尸** | [`games/number-gate/`](games/number-gate/) | 伪 3D 走廊撞数字门升级武器，向可见僵尸群扫射；被碰到才死 |

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

## 数字门 · 玩法与控制（v2）

- **自动前进**，左右换道撞入数字门（`+N` / `×N` / `-N`）与武器拾取台 → **升级武器**（等级 / 弹道 / 射速 / 伤害）
- 前方与侧前方有 **大量可见僵尸**；玩家 **自动射击** 清怪
- **失败唯一条件：** 僵尸冲到面前碰到玩家（禁止看不见就死）
- **战役** 8 关 + **无尽** 尸潮

控制：

- 键盘：`←` / `A` 左，`→` / `D` 右，`P` / `Esc` 暂停，空格开始
- 触控：左右滑动，或点屏幕两侧圆形按钮

设计文档：`docs-number-gate-weapon-zombie-GDD.md`

## 部署

整仓丢到 GitHub Pages / Cloudflare Pages / Netlify / 任意静态托管即可，**无需 build**。

Pages 入口设为仓库根目录（`index.html`）。

## 自测

```bash
node games/number-gate/tests/core-test.js
node games/samegame/tests/core-test.js
```

详见 `games/number-gate/SELFTEST.md` 与 `games/samegame/SELFTEST.md`。

## 视觉

数字门：强透视伪 3D 走廊、霓虹路沿、数字门、武器拾取台、成群僵尸与可见弹道。SameGame：糖果高光方块、碎片粒子与连击大字。逻辑在 `core.js`，表现层在 `render.js` / `particles.js` / `ui.js`。零构建。

## License

代码以可自由使用为目的提供；第三方参考仓库仅作调研，未复制其素材。
