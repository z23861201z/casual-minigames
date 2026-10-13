/**
 * Sand Bucket level patterns.
 * Chars: . empty, 0-9 color index. Rows in a level share one width.
 * Global: SBLevels
 */
(function (global) {
  'use strict';

  function rows(width, packed) {
    var s = String(packed).replace(/\s+/g, '');
    if (s.length % width !== 0) {
      throw new Error('Sand pattern length ' + s.length + ' not divisible by ' + width);
    }
    var out = [];
    for (var i = 0; i < s.length; i += width) out.push(s.slice(i, i + width));
    return out;
  }

  var LEVELS = [
    {
      id: 1,
      name: '小爱心',
      releaseMs: 280,
      spillRate: 0.14,
      slots: 4,
      rows: rows(10, [
        '.11111111.',
        '1113333111',
        '1133333311',
        '1133333311',
        '.11333311.',
        '..113311..',
        '...1111...',
        '....11....'
      ].join(''))
    },
    {
      id: 2,
      name: '柠檬星',
      releaseMs: 240,
      spillRate: 0.12,
      slots: 4,
      rows: rows(9, [
        '....6....',
        '...666...',
        '..66666..',
        '.6666666.',
        '666666666',
        '.6622262.',
        '..62226..',
        '...222...',
        '....2....'
      ].join(''))
    },
    {
      id: 3,
      name: '小黄鸭',
      releaseMs: 220,
      spillRate: 0.1,
      slots: 4,
      rows: rows(11, [
        '....888....',
        '...88888...',
        '..8822288..',
        '..8822288..',
        '...88888...',
        '..6666666..',
        '.666666666.',
        '..6666666..',
        '...22222...'
      ].join(''))
    },
    {
      id: 4,
      name: '猫咪吐司',
      releaseMs: 200,
      spillRate: 0.1,
      slots: 5,
      rows: rows(12, [
        '44........44',
        '44........44',
        '.0000000000.',
        '.0900000090.',
        '.0900000090.',
        '.0009090000.',
        '.0000990000.',
        '.0030003000.',
        '..00000000..',
        '...000000...',
        '....4444....'
      ].join(''))
    },
    {
      id: 5,
      name: '生日蛋糕',
      releaseMs: 180,
      spillRate: 0.09,
      slots: 5,
      rows: rows(12, [
        '...666666...',
        '..68888886..',
        '..68811886..',
        '.1111111111.',
        '.1222222221.',
        '.1222222221.',
        '.1111111111.',
        '....4444....'
      ].join(''))
    },
    {
      id: 6,
      name: '窗台花园',
      releaseMs: 150,
      spillRate: 0.08,
      slots: 5,
      rows: rows(11, [
        '....111....',
        '..1133311..',
        '.133333331.',
        '13337773331',
        '.133333331.',
        '..1133311..',
        '....777....',
        '....777....',
        '....444....',
        '....444....'
      ].join(''))
    }
  ];

  global.SBLevels = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof window !== 'undefined' ? window : global);
