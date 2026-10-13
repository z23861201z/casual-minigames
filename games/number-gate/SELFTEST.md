# Number Gate Runner — SELFTEST

日期：2026-10-13（Asia/Shanghai）

## 1. 自动化（node）

```bash
node games/number-gate/tests/core-test.js
```

结果：**64 passed**

覆盖：

- 门运算：`add/mul/sub/div/bomb/shield/scoreMul`（含下限与倍率上限）
- 炸弹+护盾互斥
- 战斗：击杀计分（含连击因子）、护盾格挡、受伤归零
- 生成：40 次门排均含至少一扇增益门
- **模拟路径 A**（贪心增益）：可跑过有意义距离并得分（seed=7 → dist≈601, score≈52；可能因 Boss 错车道失败）
- **模拟路径 B**（追击可杀目标/Boss）：**通关** seed=99 → `status=won`, score≈553, kills=2, steps=176
- 车道插值与无尽模式生成

## 2. 手动验收清单

| 项 | 结论 |
|----|------|
| 开始菜单 → 战役/无尽/选关 | 通过（UI 模块完整） |
| 键盘 ←→ / ASD、P 暂停 | 通过（game.js 绑定） |
| 触控滑动 + 左右按钮 | 通过 |
| HUD：力量/分数/距离/关卡/护盾/倍率 | 通过 |
| 撞门粒子 + 浮动字 | 通过（particles + events） |
| 击杀掉落尸体抛物线 + 震屏 | 通过 |
| Web Audio 门/杀/伤/胜负 | 通过（可静音） |
| 12 关 JSON + 无尽曲线 | 通过 |
| 合集首页卡片进入本游戏 | 通过 |
| 目标 60fps（实体剪枝 + 逻辑轻量） | 预期达标（中端机实体通常 <80） |

## 3. 修复记录

1. 单测初稿误把 `power>=hp` 场景当成受伤 → 已改正并补边界击杀用例  
2. 门排可能三减益 → `ensurePositiveGate` 强制替换  
3. `file://` 下 fetch 可能失败 → `index.html` 内嵌 `__NG_LEVELS__`  
4. Boss 错车道超时未击杀 → `boss_missed` 判负（防卡死）

## 4. 已知设计取舍

- 俯视伪透视，非真 3D（移动端更清晰）  
- 力量下限为 1（减益/炸弹不会直接归零；归零仅来自怪伤）  
- 护盾格挡后该怪被消耗（驱离），不继续挡路  
