/* Fileora module: Fileora AI (2 tools on the processing server, which uses the Claude API). */
(function (E) {
  'use strict';
  if (!E) return;
  const { LANGS } = E.h;
  E.register({ id: 'summarize', server: true, accept: 'pdf', cta: 'Summarize', verb: 'Reading and summarizing', textTitle: 'Your summary is ready',
    opts: [
      { id: 'len', type: 'seg', label: 'Length', value: 'medium', choices: [['short', 'Short'], ['medium', 'Medium'], ['long', 'Detailed']] },
      { id: 'style', type: 'seg', label: 'Style', value: 'bullets', choices: [['bullets', 'Bullet points'], ['para', 'Paragraphs']] },
      { id: 'lang', type: 'select', label: 'Write the summary in', value: 'en', choices: LANGS }
    ] });
  E.register({ id: 'translate', server: true, accept: 'pdf', cta: 'Translate PDF', verb: 'Translating', textTitle: 'Your translation is ready',
    opts: [{ id: 'to', type: 'select', label: 'Translate into', value: 'hi', choices: LANGS }] });
})(window.FileoraEngine);
