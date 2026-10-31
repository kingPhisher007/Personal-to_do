(function () {
  var btn = document.getElementById('copyBtn');
  var src = document.getElementById('copySrc');
  if (btn && src) {
    btn.addEventListener('click', function () {
      var text = src.textContent;
      function done() {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove();
        done();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  }

  var t = document.getElementById('exp');
  if (!t) return;
  var end = Date.parse(t.getAttribute('datetime'));
  function paint() {
    var ms = end - Date.now();
    if (ms <= 0) { location.reload(); return; }
    var mins = Math.round(ms / 60000);
    var rel;
    if (mins < 1) rel = 'in less than a minute';
    else if (mins < 60) rel = 'in ' + mins + (mins === 1 ? ' minute' : ' minutes');
    else if (mins < 1440) { var h = Math.round(mins / 60); rel = 'in ' + h + (h === 1 ? ' hour' : ' hours'); }
    else { var d = Math.round(mins / 1440); rel = 'in ' + d + (d === 1 ? ' day' : ' days'); }
    t.textContent = rel + ' (' + new Date(end).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ')';
  }
  paint();
  setInterval(paint, 15000);
})();
