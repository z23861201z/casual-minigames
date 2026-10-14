# Casual Minigames

纯静态精品休闲小游戏合集（零构建 · 可直接打开 · 可静态部署）。

## 游戏

| 游戏 | 路径 | 简介 |
|------|------|------|
| **拼图解压馆** | [`games/sand-bucket/`](games/sand-bucket/) | 像素画碎成沙，彩色桶在传送带上接住、装满合成、灌回拼图 |
| **消除我可以** | [`games/duck-pop/`](games/duck-pop/) | 鸭子按颜色和弹药打穿同色像素，碎块流体下落 |
| **向末日开炮** | [`games/doom-gates/`](games/doom-gates/) | 自动跑、左右滑、自动开火；数字门改小队人数，终点武器认人数 |

合集首页：[index.html](index.html)

首页三张卡：

- [拼图解压馆](games/sand-bucket/index.html)
- [消除我可以](games/duck-pop/index.html)
- [向末日开炮](games/doom-gates/index.html)

旧原型（SameGame、抽象数字门）在 [archive/](archive/)，不出现在首页卡片上。

## 本地打开

无需安装依赖，也没有构建步骤：

```bash
# 方式 A：直接用浏览器打开
open index.html

# 方式 B：任意静态服务器
python3 -m http.server 8080
```

然后打开首页，或直接进入三张卡：

- [合集首页](index.html)
- [拼图解压馆](games/sand-bucket/index.html)
- [消除我可以](games/duck-pop/index.html)
- [向末日开炮](games/doom-gates/index.html)

`file://` 可用：关卡写在脚本里，不请求 JSON。

## 玩法

**流沙接桶。** 10 关。点手牌上的桶，再点传送带空位。同色沙才会进去。两个装满、同色、同容量的桶合成一个更大的桶，桶上能看见沙面涨起来。洒出超过预算即失败，沙子全部送回拼图即过关。铲子、彩虹桶、磁铁用完后弹出本地广告位（不连真广告）。

**鸭子发射。** 10 关。点一只鸭子放到发射台，再点同色的一列。只消除同色像素，打不中不扣弹药。碎块流体下落并压实。石头挡住弹道。底部按钮：2 倍速、升级、清除、打乱。不是点相邻格子的 SameGame。

**向末日开炮。** 10 关。按住左右滑，或方向键 / A D，小队跟手且始终在路面内。自动前进、自动射击。人、丧尸、门和子弹共用同一套投影，脚底贴在路上。尸潮在路中间成团涌来。`+` `×` 增加人数，`-` `÷` 减少。子弹打在门上会把数字改得更赚，打在终点门上会降低人数门槛（最低到原需求的 55%）。丧尸碰到小队，或人数被门减到 0，才会失败。人不够就拿不到终点武器。本期没有基地 SLG。

## 部署

整仓丢到 GitHub Pages / Cloudflare Pages / Netlify / 任意静态托管即可，**无需 build**。

Pages 入口设为仓库根目录（`index.html`）。

## 自测

```bash
node games/sand-bucket/tests/core-test.js
node games/duck-pop/tests/core-test.js
node games/doom-gates/tests/core-test.js
```

角色图由 `python3 tools/pack_ad_sprites.py` 从 `tools/plates/` 抠成脚底对齐的透明精灵（`tools/gen_doom_sprites.py` 会优先走这条）。不抓取网页素材。

## License

代码以可自由使用为目的提供。画面为程序化原创，未复制第三方素材。
