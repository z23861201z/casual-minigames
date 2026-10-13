# 三款抖音超休闲小游戏规格（按豆包拆解重做，禁止旧玩法）

用户驳回：SameGame 连连看、旧 Number Gate 抽象撞怪。必须按下列三款重建。纯静态 HTML/JS/Canvas，零构建。用 Grok Build 生成玩法与 UI 素材。

参考截图：
- 流沙接桶：/home/box/agent-data/agents/b87f98f7-fc65-42df-bc3c-a2b993824daf/attachments/dd9e511cc6ddc2ba5cc68e0a81c686451b0e5ad329d87be3087b194713ade05e.jpg
- 鸭子发射：/home/box/agent-data/agents/b87f98f7-fc65-42df-bc3c-a2b993824daf/attachments/1cc72c60b52edc52a8b85d27368b7df447eb3132cddb9654c3d0a659a5f5e7d6.jpg
- 末日数字门：/home/box/agent-data/agents/b87f98f7-fc65-42df-bc3c-a2b993824daf/attachments/47224c06a37e7e70b24ea76e5a1712fc17947431f8cb81736d14e967108182f4.jpg

## 游戏 A：拼图解压馆（流沙像素接沙桶）
路径：games/sand-bucket/
机制：画布上半是像素图案；沙子粒子重力下落；中间传送带放同色收集桶；同色沙进同色桶；桶有容量；装满后同色同容量桶可合成更大桶；目标收集填满图案；连击；道具铲子/彩虹球/磁铁（可先做本地免费次数，预留广告钩子 UI）；放置次数上限。
美术：马卡龙柔和、软圆角、治愈。

## 游戏 B：消除我可以（鸭子发射像素，Cube Pop 类）
路径：games/duck-pop/
机制：上方像素积木图案；下方鸭子池，鸭子有颜色+弹药数字；点选鸭子放到发射台，向上发射只消同色方块；击碎像素流体粒子下落；清空图案通关；按钮：2倍速/升级/清除/打乱。
美术：明亮卡通、沙滩感、Q萌鸭子。

## 游戏 C：向末日开炮（数字门跑酷射击）
路径：games/doom-gates/（或重写 games/number-gate/ 为此玩法）
机制：自动前进+左右滑动；自动开火；成对数字门（+/-/×）改小队人数；可射击门改变门上数字（差异化）；路上可见丧尸群被小队射击；终点大型武器需人数门槛；人越多火力越强；被丧尸撞到/人数归零才失败，丧尸必须大而可见。
美术：3D卡通末日、大门大数字、高饱和发光。
本期只做跑酷关卡模块（不做基地 SLG）。

## 合集首页
更新 index.html：三张游戏卡片，去掉错误的 SameGame 作为主推（可归档到 archive/ 或删除入口）。

## 交付
- Grok Build（grok-4.7 --reasoning-effort xhigh --always-approve）实现
- 原创 UI 素材用脚本/Canvas 生成，勿下网图
- 每款可玩至少数关或无尽原型 + 爽感粒子
- commit + push https://github.com/z23861201z/casual-minigames
