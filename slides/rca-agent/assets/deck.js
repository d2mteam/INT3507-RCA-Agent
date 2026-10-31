/* Diagrams are saved SVG rendered from the adjacent .mmd sources with Mermaid 9.4.3.
 * No layout measurements or diagram rendering are needed when switching slides. */
window.addEventListener('load', function () {
  const errors = [];
  if (window.katex) {
    document.querySelectorAll('body > .deck > .slide .m').forEach(function (el) {
      try {
        katex.render(el.textContent, el, { throwOnError: true, displayMode: false });
      } catch (error) {
        errors.push('Formula: ' + error.message);
      }
    });
  } else {
    errors.push('KaTeX could not be loaded.');
  }
  const sources = document.querySelectorAll('body > .deck > section.slide');
  document.querySelectorAll('.overview .mini-slide > section.slide').forEach((thumb, i) => {
    if (!sources[i]) return;
    thumb.innerHTML = sources[i].innerHTML;
    thumb.className = sources[i].className.replace(/\bis-(active|prev)\b/g, '').trim() + ' is-active';
    thumb.style.padding = '';
    // Isolate marker IDs in overview copies from the original diagrams.
    thumb.querySelectorAll('svg marker[id]').forEach(marker => {
      const oldId = marker.id;
      const newId = 'thumb-' + i + '-' + oldId;
      thumb.querySelectorAll('[marker-start], [marker-mid], [marker-end]').forEach(edge => {
        ['marker-start', 'marker-mid', 'marker-end'].forEach(attr => {
          const value = edge.getAttribute(attr);
          if (value) edge.setAttribute(attr, value.replace('#' + oldId + ')', '#' + newId + ')'));
        });
      });
      marker.id = newId;
    });
  });
  window.deckRenderErrors = errors;
  if (errors.length) console.error('[RCA slides]', errors);
  document.documentElement.dataset.diagramsReady = 'true';
});
