/**
 * Duck Pop levels. Digits are colors, "." empty, "X" stone.
 * Global: DPLevels
 */
(function (global) {
  'use strict';

  function rows(width, packed) {
    var s = String(packed).replace(/\s+/g, '');
    if (s.length % width !== 0) {
      throw new Error('Duck pattern length ' + s.length + ' not divisible by ' + width);
    }
    var out = [];
    for (var i = 0; i < s.length; i += width) out.push(s.slice(i, i + width));
    return out;
  }

  var LEVELS = [
    {
      id: 1,
      name: '双色条纹',
      bonus: 0.35,
      shuffles: 2,
      clears: 2,
      stars: 3,
      rows: rows(6, [
        '010101',
        '010101',
        '010101',
        '010101',
        '010101',
        '010101'
      ].join(''))
    },
    {
      id: 2,
      name: '三层蛋糕',
      bonus: 0.25,
      shuffles: 2,
      clears: 2,
      stars: 2,
      rows: rows(7, [
        '2222222',
        '2222222',
        '1111111',
        '1111111',
        '0000000',
        '0000000'
      ].join(''))
    },
    {
      id: 3,
      name: '爱心软糖',
      bonus: 0.2,
      shuffles: 2,
      clears: 2,
      stars: 2,
      rows: rows(8, [
        '.112211.',
        '11222211',
        '12000021',
        '12000021',
        '11222211',
        '.112211.',
        '..1111..',
        '...11...'
      ].join(''))
    },
    {
      id: 4,
      name: '小黄鸭',
      bonus: 0.15,
      shuffles: 2,
      clears: 2,
      stars: 2,
      rows: rows(9, [
        '...111...',
        '..11111..',
        '.1133311.',
        '.1133311.',
        '..11111..',
        '.2222222.',
        '222222222',
        '.2222222.',
        '..44444..'
      ].join(''))
    },
    {
      id: 5,
      name: '蘑菇屋',
      bonus: 0.12,
      shuffles: 2,
      clears: 3,
      stars: 2,
      rows: rows(9, [
        '...000...',
        '..00000..',
        '.0011100.',
        '000111000',
        '000111000',
        '..22222..',
        '..2X2X2..',
        '..22222..',
        '...222...'
      ].join(''))
    },
    {
      id: 6,
      name: '小鱼',
      bonus: 0.12,
      shuffles: 2,
      clears: 2,
      stars: 2,
      rows: rows(10, [
        '....55....',
        '...5555...',
        '..550055..',
        '.55555555.',
        '333555553.',
        '.55555555.',
        '..555555..',
        '...5555...',
        '....55....'
      ].join(''))
    },
    {
      id: 7,
      name: '星星糖',
      bonus: 0.1,
      shuffles: 1,
      clears: 2,
      stars: 2,
      rows: rows(9, [
        '....4....',
        '...444...',
        '..44444..',
        '.4444444.',
        '444444444',
        '.4422242.',
        '..42224..',
        '...2X2...',
        '....2....'
      ].join(''))
    },
    {
      id: 8,
      name: '幽灵夜',
      bonus: 0.1,
      shuffles: 2,
      clears: 3,
      stars: 1,
      rows: rows(9, [
        '..77777..',
        '.7777777.',
        '.7097907.',
        '777777777',
        '777777777',
        '.7777777.',
        '..77X77..',
        '...777...',
        '..7...7..'
      ].join(''))
    },
    {
      id: 9,
      name: '沙滩冰棍',
      bonus: 0.3,
      shuffles: 2,
      clears: 2,
      stars: 2,
      rows: rows(8, [
        '..5555..',
        '.555555.',
        '44444444',
        '33333333',
        '22222222',
        '11111111',
        '00000000'
      ].join(''))
    },
    {
      id: 10,
      name: '海岛蛋糕',
      bonus: 0.28,
      shuffles: 2,
      clears: 2,
      stars: 2,
      rows: rows(9, [
        '...888...',
        '..88888..',
        '.8866688.',
        '111111111',
        '2222X2222',
        '333333333',
        '.4444444.',
        '..55555..'
      ].join(''))
    }
  ];

  global.DPLevels = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof window !== 'undefined' ? window : global);
