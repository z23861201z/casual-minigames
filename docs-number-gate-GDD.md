# Number Gate Runner — 游戏设计文档（GDD）

> 版本：1.0 · 2026-10-13 · 公测成品目标  
> 技术：纯静态 HTML/JS/Canvas · 零构建 · 移动优先

---

## 1. 一句话与核心幻想

**一句话：** 自动狂奔的三车道数字门跑酷——撞门变强，碾压怪物，越跑越爽。  
**核心幻想：** 「我选对了门，数字暴涨，怪被我撞飞。」

---

## 2. 核心循环（30 秒可懂）

1. **自动前进**，玩家用左右切换 **3 车道**  
2. 前方出现 **数字门**（同排 2–3 扇），撞入一扇 → 力量数值按运算更新  
3. 遇到 **怪物**：力量 ≥ 怪 HP → 击杀得分；否则受伤/破盾/失败  
4. 跑完关卡距离或击败 Boss → 通关；力量归零 → 失败  
5. 追求更高分、连击与倍率

```
Start → Run → Choose Gate → Fight → (Loop) → Win/Lose → Retry/Next
```

---

## 3. 门类型

| id | 标签示例 | 效果 | 视觉 |
|----|----------|------|------|
| `add` | `+15` | power += n | 绿色门 |
| `mul` | `×2` | power *= n | 金色/紫色门 |
| `sub` | `-10` | power = max(1, power-n) | 红色门 |
| `div` | `÷2` | power = max(1, floor(power/n)) | 深红门（后期） |
| `bomb` | 💣 | 无盾：power=max(1,floor(power/2))；有盾：吞盾 | 黑橙闪烁 |
| `shield` | 🛡 | 获得护盾（挡一次伤害/炸弹） | 青色门 |
| `scoreMul` | `SCORE×` | scoreMult += 0.5（封顶 4） | 洋红门 |

**门排规则：** 同排至少 1 扇非减益（add/mul/shield/scoreMul）；减益与增益并置制造决策。

---

## 4. 打怪结算

- 实体：`{ lane, hp, kind: 'grunt'|'elite'|'boss' }`  
- `power >= hp` → kill：`score += floor(hp * scoreMult * (1 + combo*0.1))`，combo++，击飞爆炸  
- `power < hp`：  
  - 有 shield → 破盾，怪仍存活并被推开一小段或直接清除（本设计：破盾并击退怪，不扣力量）  
  - 无盾 → `power = max(0, power - hp)`；若 power==0 → Game Over  
- Boss：关卡终点，必须击杀才算通关（力量不足则失败）

---

## 5. 爽感规格（必须落地）

| ID | 规格 | 验收 |
|----|------|------|
| J1 | 撞门粒子 ≥12 颗，色随门类型 | 肉眼可见喷溅 |
| J2 | 浮动运算文字（`+15`/`×2`）上浮淡出 ≥400ms | 可读 |
| J3 | 连击≥3 HUD 高亮 + 音高上升 | 可感知 |
| J4 | 击杀震屏 80–160ms，幅度随怪体型 | 可感知 |
| J5 | Web Audio：门/击杀/受伤/通关 | 有声（可静音） |
| J6 | 速度线/背景滚动随 speed 加快 | 速度感 |
| J7 | 怪死亡：击飞抛物线 + 碎片爆炸 | 非瞬删 |

---

## 6. 控制与 HUD

**控制**

- 键盘：←/A 左、→/D 右、P/Esc 暂停、空格开始/继续  
- 触摸：左右滑动换道；屏幕左右按钮；顶部暂停  
- 防止页面滚动：touch-action / preventDefault

**HUD**

- 力量（大号）· 分数 · 距离/关卡进度 · 连击 · 护盾图标 · 倍率

**界面流**

- 开始菜单（选关/无尽）→ 游戏 → 暂停 → 结束（重试/下一关/回首页）

---

## 7. 关卡与难度曲线

### 7.1 模式

- **战役：** 12 关（见 `levels.json`）  
- **无尽：** 使用 `endless` 曲线，速度与怪 HP 随距离指数爬升

### 7.2 难度曲线 JSON 概要

字段：`id, name, startPower, targetDistance, baseSpeed, maxSpeed, accel, gateGap, enemyGap, gateTable, enemyTable, boss`

详见 `/workspace/casual-minigames/games/number-gate/data/levels.json`。

曲线原则：

1. 关 1–2：只 add/mul/sub，低速，教学  
2. 关 3–5：引入 shield、bomb，出现 elite  
3. 关 6–9：div、更高倍率门、更密门距  
4. 关 10–12：Boss + 高压门排，要求规划乘区  
5. 无尽：每 500m 提升 speed 与 hpScale

---

## 8. 技术选型

| 项 | 选择 | 理由 |
|----|------|------|
| 运行时 | 浏览器原生 | 零构建、可 file:// 与静态托管 |
| 渲染 | Canvas 2D | 粒子/震屏/伪透视够用 |
| 逻辑 | 纯 JS IIFE 模块 | 与 SameGame 一致，可 node 测 |
| 音频 | Web Audio API 合成 | 无资源文件 |
| 数据 | levels.json 内嵌或 fetch | 静态友好；file:// 时内嵌兜底 |
| 布局 | 逻辑分辨率 390×700，CSS 适配 | 移动优先 |

---

## 9. 模块结构

```
core.js       applyGate, resolveCombat, spawnRow, stepWorld, score…
particles.js  emit, update, draw hooks
audio.js      beep/sweep 音效 + mute
render.js     车道、门、怪、玩家、背景、浮动字
ui.js         DOM 菜单/HUD/结束面板
game.js       输入、rAF 循环、状态机、关卡加载
```

---

## 10. 合集首页信息架构

```
casual-minigames/
  index.html     # Hub：英雄区 + 游戏卡片网格
  css/hub.css
  games/samegame/
  games/number-gate/
  README.md
```

**卡片字段：** 标题、一句话、标签（益智/跑酷）、封面渐变/CSS 插画、CTA「开始玩」  
**扩展：** 「即将推出」占位卡（可配置数组）  
**导航：** 顶栏 Brand · 游戏 · GitHub；页脚说明静态部署

---

## 11. 成功标准（公测）

- [ ] 可完整通关至少前 3 关；无尽可跑 60s+  
- [ ] 触控与键盘均可用；竖屏友好  
- [ ] 60fps 目标（中端机逻辑实体 <80）  
- [ ] node 核心测试通过  
- [ ] Hub 美观可作未来合集入口  
- [ ] 公开 GitHub 仓库可 clone 即玩
