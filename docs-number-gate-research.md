# Number Gate Runner — 阶段1调研报告

> 日期：2026-10-13（Asia/Shanghai）  
> 范围：开源无尽跑酷 / 数学门跑酷算法与架构总结，支撑 GDD 与纯静态实现  
> **本报告不含游戏实现代码**

---

## 1. 调研摘要

「数字门跑酷」= **自动前进的多车道跑酷** + **撞门改写数值（力量/队伍）** + **遇怪用当前数值结算**。短视频爆款变体（Count Masters / Crowd Run / Number Gate）强调：

1. 一眼可读的门标签（`+12` / `×2` / `-8`）
2. 左右选择的即时决策压力
3. 数值膨胀带来的「变强爽感」与打怪击飞反馈

开源生态没有完整「数字门打怪」成品，但可拆成可借鉴子系统：

| 子系统 | 最佳参考 | 可拿走什么 |
|--------|----------|------------|
| 三车道 + 变道插值 | GameHelix/temple_run | `lane/targetLane/laneT`、碰撞用有效车道、速度爬升 |
| 键盘+滑动输入 | temple_run `useInput` | 单帧脉冲队列、SWIPE_THRESHOLD≈30px |
| 平台滚动跑酷骨架 | straker/endless-runner-html5-game | Canvas 主循环、资产预载、平台生成、视差 |
| 数学题门交互 | bryankeeling06-eng/math-trail | 门实体、砸碎动画、粒子 burst、连击/生命 |
| 跑酷+数学题 | kushgupta-official/MathsRunner | Phaser 平台生成、答对加分答错扣分（引擎重，仅借鉴节奏） |
| 极简无尽跑 | lrusso/EndlessRunner | 单文件结构、障碍循环 |

**本产品技术选型结论：** Vanilla HTML/JS/Canvas，零构建；逻辑层纯函数可 node 单测；渲染/粒子/音频分模块（对齐已有 SameGame 结构）。

---

## 2. 仓库逐项：算法与架构

### 2.1 straker/endless-runner-html5-game

- URL: https://github.com/straker/endless-runner-html5-game  
- 形态：三部分教程（part1–3），纯 Canvas + 精灵图  
- 核心循环：`requestAnimationFrame` → 更新玩家/平台/敌人 → 视差背景 → 碰撞  
- 平台生成：`platformLength` / `gapLength` / `platformHeight` 随机，保证可行走路径  
- 玩家：跳跃状态机（jumpDy、落地检测）  
- **借鉴：** 滚动世界用「物体向左移动」模拟前进；ticker 控制障碍密度；游戏结束/重置清晰  
- **缺口：** 无车道选择、无数字门、无数值战斗

### 2.2 GameHelix/temple_run

- URL: https://github.com/GameHelix/temple_run  
- 形态：Next.js + TS + Canvas 伪 3D 霓虹跑酷（无引擎）  
- **三车道模型（关键可移植）：**
  - `lane` / `targetLane` / `laneT∈[0,1]`，`LANE_CHANGE_FRAMES≈12`
  - 碰撞时用有效车道：`laneT < 0.5 ? lane : targetLane`
  - 键盘左右 + 触摸滑动（阈值 30px）
- **难度：** 障碍 pattern 表（easy/medium/hard），`MIN_GAP` 随难度缩小，`SPEED_INCREASE` 每帧微量加速  
- **爽感：** `spawnParticlesBurst`、分数倍率、无敌帧、相机 Z 推进  
- **借鉴：** 车道状态机、输入脉冲、难度曲线常量表、粒子击中反馈  
- **缺口：** 非数字门；依赖 React/Next（本项目需去框架化）

### 2.3 lrusso/EndlessRunner

- URL: https://github.com/lrusso/EndlessRunner  
- 形态：单文件 JS + HTML，极简无尽跑  
- **借鉴：** 部署友好的零依赖结构；障碍循环复用  
- **缺口：** 玩法与视觉都过简，无数学/门机制

### 2.4 kushgupta-official/MathsRunner

- URL: https://github.com/kushgupta-official/MathsRunner  
- 形态：Phaser 3 横向平台跑酷 + 题目物件  
- 参数：`platformStartSpeed`、`spawnRange`、`coinPercent`/`quesPercent`、答对 +30 / 答错 -10  
- **借鉴：** 「跑酷途中插入数学决策」节奏；分数奖惩  
- **缺口：** Phaser 依赖重；题目 UI 非「撞门改数值」；无队伍/打怪

### 2.5 bryankeeling06-eng/math-trail

- URL: https://github.com/bryankeeling06-eng/math-trail  
- 形态：纯 Canvas 儿童数学 trail；门 + 选择题  
- **门生命周期：** `spawnGate` → 接近 → 答题/碰撞 → `smashGate` + `burst` 粒子 + `fallNums` 数字飞散  
- 连击 `streak`、生命、关卡/地点主题轮换  
- **借鉴：** 门砸碎视觉、粒子、数字飞散、连击反馈、关卡主题切换  
- **缺口：** 是「答对砸门」而非「撞门运算改力量」；无车道左右二选一

---

## 3. 可合成的核心算法（本游戏采用）

### 3.1 世界推进

```
worldScroll += speed * dt
entities.z -= speed * dt   // 或实体向玩家靠近
speed = min(maxSpeed, baseSpeed + distance * accel)
```

二维俯视/侧视均可；本项目采用 **俯视三车道**（移动友好、门左右一目了然），伪透视用近大远小缩放。

### 3.2 车道变道

```
onLeft:  targetLane = max(0, targetLane-1); laneT=0
onRight: targetLane = min(2, targetLane+1); laneT=0
laneT += dt / LANE_CHANGE_MS
visualX = lerp(laneX[lane], laneX[targetLane], ease(laneT))
```

### 3.3 门运算（纯函数）

| 类型 | 运算 | 约束 |
|------|------|------|
| add | `power += n` | n≥1 |
| mul | `power *= n` | n∈{2,3,4,5} |
| sub | `power = max(1, power - n)` | 不低于 1（避免瞬间死） |
| div | `power = max(1, floor(power / n))` | 特殊关偶用 |
| bomb | 若无护盾：`power = max(1, floor(power*0.5))`；有护盾则消耗护盾 | — |
| shield | `shield = true`（抵挡下一次伤害/炸弹） | — |
| scoreMul | `scoreMult = min(4, scoreMult + 0.5)` 限时 | — |

### 3.4 打怪结算

```
if power >= enemy.hp:
  kill → score += hp * scoreMult * comboFactor
  power 可不变或 +killBonus
  触发击飞/爆炸粒子
else:
  if shield: consume shield
  else: power = max(0, power - enemy.hp) 或即时失败（按模式）
  震屏 + 受伤音效
```

关卡模式：力量归零或撞终局 Boss 失败 → Game Over；达到目标距离/击杀 Boss → 通关。

### 3.5 碰撞

门/怪在「到达玩家深度带」且 `entity.lane === effectiveLane` 时触发一次（标记 `consumed`）。

### 3.6 生成器

- 按距离段 spawn：每 `gateGap` 生成一对/三道门（至少留一安全或优势选项）  
- 门对设计：左 `+a` 右 `×b` 等，避免三道全是减益  
- 怪穿插在门后，HP 按当前期望力量曲线标定（见 levels.json）

---

## 4. 爽感实现清单（对齐短视频门）

| 效果 | 参考来源 | 落地方式 |
|------|----------|----------|
| 门撞粒子 | math-trail burst / temple particles | particles.js 彩色喷溅 |
| 数值弹出 | math-trail fallNums | 浮动 `+12`/`×2` 文本 |
| 连击/倍率视觉 | temple scoreMultiplier | HUD 闪光 + 色环 |
| 震屏 | 通用 juice | camera shake 衰减 |
| Web Audio | SameGame audio.js 风格 | 门/击杀/受伤/连击音调 |
| 速度感 | temple speed lines | 背景条纹/粒子向后 |
| 怪击飞/爆炸 | — | 死亡态 vy/vx + 碎片 |

---

## 5. 架构建议（已写入 GDD）

```
games/number-gate/
  index.html
  css/style.css
  js/core.js      # 纯逻辑：门运算、碰撞、生成、计分
  js/particles.js
  js/audio.js
  js/render.js
  js/ui.js
  js/game.js      # 主循环、输入、状态机
  data/levels.json
  tests/core-test.js
  SELFTEST.md
```

合集首页 `casual-minigames/index.html`：卡片式入口，SameGame + Number Gate + 即将推出位。

---

## 6. 许可与合规

调研仓库仅作算法/架构参考，不复制其素材与大段源码。本项目原创实现，纯几何/程序化绘制，无第三方精灵依赖。
