/* Fileora module: File Edit. Edit PDF is pending (no editor screen yet), so only PDF Forms registers. */
(function (E) {
  'use strict';
  if (!E) return;
  E.register({ id: 'forms', server: true, accept: 'pdf', cta: 'Create fillable form', verb: 'Detecting fields',
    opts: [{ id: 'detect', type: 'seg', label: 'Detect', value: 'all', choices: [['all', 'All fields'], ['text', 'Text only'], ['check', 'Checkboxes']] }] });
})(window.FileoraEngine);
