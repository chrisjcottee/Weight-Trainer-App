let expandedTemplateId = null;  // UI-only: which prebuilt template is expanded

Views.start = function() {
  const saved = activeProgramLibrary();
  return `
    <div class="start-screen">
      <h1>Start training</h1>
      <p class="subtle">Choose a ready-made program or build your own. You can edit anything later.</p>

      <button class="btn" id="start-create" style="margin-top:18px;">+ Create program from scratch</button>

      ${saved.length ? `
        <h2>Your programs</h2>
        <div class="card">
          <div class="library-list">${saved.map(programLibraryRowHtml).join('')}</div>
        </div>
      ` : ''}

      <h2>Ready-made programs</h2>
      <div class="card">${programTemplateListHtml()}</div>
    </div>
  `;
};

function programTemplateListHtml() {
  const list = prebuiltPrograms();
  if (!list.length) return `<div class="empty" style="padding:24px 12px;">No templates available.</div>`;
  return `<div class="library-list">${list.map(programTemplateRowHtml).join('')}</div>`;
}

function programTemplateRowHtml(tpl) {
  const expanded = expandedTemplateId === tpl.id;
  const dayCount = tpl.template.length;
  return `
    <div class="library-row template-row ${expanded ? 'expanded' : ''}" data-template-id="${esc(tpl.id)}">
      <button class="template-summary" data-act="toggle-template">
        <div class="library-name">
          <div>${esc(tpl.name)}</div>
          <div class="library-meta">${tpl.weeks} weeks &middot; ${dayCount} workout${dayCount === 1 ? '' : 's'} each week</div>
          ${tpl.description ? `<div class="library-meta">${esc(tpl.description)}</div>` : ''}
        </div>
        <span class="chevron" aria-hidden="true">${expanded ? '&#9662;' : '&#9656;'}</span>
      </button>
      ${expanded ? templatePreviewHtml(tpl) : ''}
    </div>
  `;
}

function templatePreviewHtml(tpl) {
  return `
    <div class="template-preview">
      ${tpl.template.map(d => `
        <div class="template-day">
          <div class="template-day-name">${esc(d.name)}</div>
          <div class="exercise-preview-list">
            ${d.exercises.map(e => `
              <div class="exercise-preview-row">
                <span class="target">${e.sets}&times;${e.reps}</span>
                <span>${esc(e.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <button class="btn" data-act="use-template" data-template-id="${esc(tpl.id)}" style="margin-top:4px;">Use this program</button>
    </div>
  `;
}
