/* Runs before the page paints, so there is no flash of the wrong theme.
 * Two independent choices, both remembered on this device:
 *   style: 'wood' (shelves and planks) or 'paper' (plain, flat, one accent)
 *   mode:  'auto' (light from 06:00 to 19:00, dark otherwise), 'light' or 'dark' */
(function () {
  var DAY_FROM = 6;
  var DAY_TO = 19;
  var BAR = { wood: { light: '#b9864a', dark: '#6a4727' }, paper: { light: '#fffdf8', dark: '#25241f' } };

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

  var mode = read('mode');
  if (mode !== 'auto' && mode !== 'light' && mode !== 'dark') mode = 'auto';
  var wall = read('wall') === 'off' ? 'off' : 'on';
  var style = read('style');
  if (style !== 'wood' && style !== 'paper') style = 'wood';

  var T = (window.Theme = {
    mode: mode,
    style: style,
    wall: wall,
    resolve: function () {
      if (T.mode === 'light' || T.mode === 'dark') return T.mode;
      var h = new Date().getHours();
      return h >= DAY_FROM && h < DAY_TO ? 'light' : 'dark';
    },
    apply: function () {
      var r = T.resolve();
      var d = document.documentElement;
      d.dataset.theme = r;
      d.dataset.style = T.style;
      d.dataset.wall = T.wall;
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.content = BAR[T.style][r];
      return r;
    },
    setMode: function (m) { T.mode = m; write('mode', m); return T.apply(); },
    setStyle: function (s) { T.style = s; write('style', s); return T.apply(); },
    setWall: function (w) { T.wall = w === 'off' ? 'off' : 'on'; write('wall', T.wall); return T.apply(); },
  });
  T.apply();
})();
