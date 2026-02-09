const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mealRows = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function safe(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function chip(text, className = '') {
  return `<span class="chip ${className}">${safe(text)}</span>`;
}

export function renderExportHtml(payload) {
  const weekStartDate = payload.weekStartDate ?? '';
  const grid = payload.weekPlan?.grid ?? {};

  const rows = mealRows
    .map((rowName) => {
      const rowKey = rowName.toLowerCase();
      const cells = Array.from({ length: 7 }).map((_, dayIndex) => {
        const entry = grid[rowKey]?.[dayIndex] ?? null;
        if (!entry) {
          return '<td><div class="empty">-</div></td>';
        }

        const mealName = entry.mealName || entry.adHocMealName || 'Meal';
        const ingredientChips = (entry.ingredients || []).map((ingredient) => {
          const suffix = ingredient.qty > 1 ? ` x${ingredient.qty}` : '';
          return chip(`${ingredient.name}${suffix}`);
        });

        return `<td>
            <div class="cell">
              ${chip(mealName, 'meal')}
              <div class="chips">${ingredientChips.join('')}</div>
              <div class="meta">Assigned: ${safe(entry.assignedTo || 'both')} | Servings: ${safe(entry.servings || 2)}</div>
            </div>
          </td>`;
      });
      return `<tr><th>${rowName}</th>${cells.join('')}</tr>`;
    })
    .join('');

  const headerDays = dayNames.map((name) => `<th>${name}</th>`).join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #f4f7fb 0%, #ffffff 100%);
      }
      .frame {
        width: 1520px;
        min-height: 940px;
        margin: 0 auto;
        padding: 28px;
        box-sizing: border-box;
      }
      .titleRow {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 16px;
      }
      .title {
        font-size: 44px;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .subtitle {
        font-size: 30px;
        color: #0f766e;
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: #fff;
      }
      th,
      td {
        border: 2px solid #bbd8d6;
        vertical-align: top;
        padding: 8px;
      }
      thead th {
        background: #ecfeff;
        font-size: 22px;
      }
      tbody th {
        width: 170px;
        background: #f8fafc;
        font-size: 22px;
      }
      td {
        height: 180px;
      }
      .cell {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .chip {
        display: inline-block;
        margin: 2px;
        padding: 4px 9px;
        border-radius: 999px;
        background: #dbeafe;
        border: 1px solid #93c5fd;
        font-size: 15px;
      }
      .meal {
        background: #dcfce7;
        border-color: #86efac;
        font-weight: 700;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
      }
      .meta {
        margin-top: auto;
        font-size: 14px;
        color: #334155;
      }
      .empty {
        color: #94a3b8;
        font-style: italic;
        font-size: 18px;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="titleRow">
        <div class="title">Meal Bubble Planner</div>
        <div class="subtitle">Week of ${safe(weekStartDate)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Meal</th>
            ${headerDays}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
}
