/**
 * Doom Gates campaign. Squad-size runner, not weapon-stat gates.
 * Global: DGLevels
 */
(function (global) {
  'use strict';

  function Z(list) {
    return list.map(function (z) {
      return { z: z[0], x: z[1], kind: z[2] || 'walker' };
    });
  }

  var LEVELS = [
    {
      id: 1,
      name: '城郊公路',
      startSquad: 1,
      weapon: 0,
      speed: 6.3,
      gates: [
        { z: 12, left: { type: 'add', n: 1 }, right: { type: 'add', n: 8 } },
        { z: 36, left: { type: 'add', n: 4 }, right: { type: 'mul', n: 2 } },
        { z: 62, left: { type: 'sub', n: 3 }, right: { type: 'add', n: 6 } },
        { z: 88, left: { type: 'add', n: 10 }, right: { type: 'add', n: 2 } }
      ],
      zombies: Z([
        [18, 1.28, 'crowd'], [21, 1.4, 'crowd'], [24, 1.22, 'crowd'], [28, 1.36, 'crowd'],
        [26, -0.4, 'walker'], [27.2, 0.05, 'walker'], [26.4, 0.42, 'walker'],
        [48, -0.48, 'walker'], [49, -0.1, 'walker'], [48.4, 0.28, 'walker'], [50, 0.52, 'brute'],
        [76, -0.36, 'walker'], [77, 0.08, 'walker'], [76.5, 0.46, 'walker'],
        [100, -0.2, 'brute'], [101, 0.3, 'walker'], [102, -0.55, 'walker']
      ]),
      finish: { z: 118, need: 26, weapon: 1, name: '手枪' }
    },
    {
      id: 2,
      name: '高架尸潮',
      startSquad: 1,
      weapon: 1,
      speed: 6.5,
      gates: [
        { z: 12, left: { type: 'add', n: 6 }, right: { type: 'add', n: 2 } },
        { z: 34, left: { type: 'mul', n: 2 }, right: { type: 'sub', n: 4 } },
        { z: 58, left: { type: 'add', n: 8 }, right: { type: 'add', n: 12 } },
        { z: 82, left: { type: 'div', n: 2 }, right: { type: 'mul', n: 2 } },
        { z: 106, left: { type: 'add', n: 15 }, right: { type: 'sub', n: 6 } }
      ],
      zombies: Z([
        [22, -0.3, 'walker'], [23, 0.15, 'walker'], [24, 0.45, 'walker'], [25, -0.55, 'walker'],
        [20, -1.32, 'crowd'], [23, -1.4, 'crowd'], [27, -1.25, 'crowd'],
        [46, 0, 'brute'], [47, -0.4, 'walker'], [47.5, 0.4, 'walker'],
        [70, -0.2, 'walker'], [71, 0.2, 'brute'], [72, 0.55, 'walker'], [69, -0.55, 'walker'],
        [96, 0.1, 'brute'], [97, -0.35, 'walker'], [98, 0.4, 'walker'], [99, 0, 'walker'],
        [120, -0.2, 'brute'], [121, 0.35, 'brute']
      ]),
      finish: { z: 136, need: 48, weapon: 2, name: '步枪' }
    },
    {
      id: 3,
      name: '夜色街区',
      startSquad: 1,
      weapon: 2,
      speed: 6.6,
      gates: [
        { z: 12, left: { type: 'mul', n: 2 }, right: { type: 'add', n: 5 } },
        { z: 34, left: { type: 'add', n: 10 }, right: { type: 'add', n: 4 } },
        { z: 56, left: { type: 'sub', n: 8 }, right: { type: 'mul', n: 2 } },
        { z: 80, left: { type: 'add', n: 16 }, right: { type: 'div', n: 2 } },
        { z: 104, left: { type: 'mul', n: 2 }, right: { type: 'add', n: 8 } },
        { z: 128, left: { type: 'add', n: 20 }, right: { type: 'sub', n: 10 } }
      ],
      zombies: Z([
        [24, -0.2, 'walker'], [25, 0.25, 'walker'], [26, 0.5, 'brute'],
        [44, -0.45, 'walker'], [45, 0, 'walker'], [46, 0.4, 'walker'], [47, -0.1, 'walker'],
        [68, 0.15, 'brute'], [69, -0.4, 'brute'], [70, 0.45, 'walker'],
        [92, 0, 'walker'], [93, -0.35, 'walker'], [94, 0.35, 'walker'], [95, 0.6, 'brute'],
        [118, -0.2, 'brute'], [119, 0.25, 'brute'], [120, -0.55, 'walker'], [121, 0.55, 'walker'],
        [142, 0, 'brute'], [143, -0.4, 'walker'], [144, 0.4, 'walker']
      ]),
      finish: { z: 160, need: 80, weapon: 3, name: '霰弹枪' }
    },
    {
      id: 4,
      name: '商场天台',
      startSquad: 1,
      weapon: 3,
      speed: 6.8,
      gates: [
        { z: 14, left: { type: 'add', n: 8 }, right: { type: 'mul', n: 3 } },
        { z: 38, left: { type: 'add', n: 12 }, right: { type: 'sub', n: 5 } },
        { z: 62, left: { type: 'mul', n: 2 }, right: { type: 'add', n: 10 } },
        { z: 88, left: { type: 'add', n: 18 }, right: { type: 'div', n: 2 } },
        { z: 114, left: { type: 'sub', n: 12 }, right: { type: 'add', n: 14 } },
        { z: 140, left: { type: 'mul', n: 2 }, right: { type: 'add', n: 6 } }
      ],
      zombies: Z([
        [26, 0, 'walker'], [27, -0.4, 'walker'], [28, 0.4, 'brute'],
        [50, -0.2, 'brute'], [51, 0.3, 'walker'], [52, -0.55, 'walker'], [53, 0.55, 'walker'],
        [76, 0.1, 'brute'], [77, -0.35, 'brute'], [78, 0.45, 'walker'], [79, 0, 'walker'],
        [102, -0.15, 'brute'], [103, 0.25, 'brute'], [104, -0.5, 'walker'], [105, 0.55, 'walker'],
        [128, 0, 'brute'], [129, -0.4, 'walker'], [130, 0.4, 'brute'],
        [154, -0.2, 'brute'], [155, 0.2, 'brute'], [156, 0.55, 'walker'], [157, -0.55, 'walker']
      ]),
      finish: { z: 176, need: 140, weapon: 4, name: '加特林' }
    },
    {
      id: 5,
      name: '末日广场',
      startSquad: 1,
      weapon: 4,
      speed: 7,
      gates: [
        { z: 14, left: { type: 'mul', n: 2 }, right: { type: 'add', n: 10 } },
        { z: 40, left: { type: 'add', n: 16 }, right: { type: 'mul', n: 2 } },
        { z: 66, left: { type: 'sub', n: 10 }, right: { type: 'add', n: 20 } },
        { z: 94, left: { type: 'mul', n: 2 }, right: { type: 'div', n: 2 } },
        { z: 122, left: { type: 'add', n: 24 }, right: { type: 'sub', n: 8 } },
        { z: 150, left: { type: 'mul', n: 2 }, right: { type: 'add', n: 12 } },
        { z: 178, left: { type: 'add', n: 30 }, right: { type: 'sub', n: 15 } }
      ],
      zombies: Z([
        [28, -0.3, 'walker'], [29, 0.2, 'brute'], [30, 0.5, 'walker'],
        [52, 0, 'brute'], [53, -0.45, 'walker'], [54, 0.45, 'brute'],
        [80, -0.2, 'brute'], [81, 0.25, 'brute'], [82, -0.55, 'walker'], [83, 0.55, 'walker'],
        [108, 0.1, 'brute'], [109, -0.35, 'brute'], [110, 0.45, 'walker'], [111, 0, 'brute'],
        [136, -0.15, 'brute'], [137, 0.3, 'brute'], [138, -0.5, 'walker'], [139, 0.6, 'walker'],
        [164, 0, 'brute'], [165, -0.4, 'brute'], [166, 0.4, 'brute'],
        [192, -0.2, 'brute'], [193, 0.25, 'brute'], [194, 0.55, 'walker'], [195, -0.55, 'brute']
      ]),
      finish: { z: 214, need: 260, weapon: 5, name: '火箭筒' }
    }
  ];

  global.DGLevels = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof window !== 'undefined' ? window : global);
