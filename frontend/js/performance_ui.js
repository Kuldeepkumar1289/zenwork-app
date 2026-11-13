

async function renderPerformanceSection() {
  const perf = await fetchOr(API.analytics, {});

  const total   = allTasks.length;
  const count   = test => allTasks.filter(test).length;
  const done    = count(t => t.status === "COMPLETED");
  const blocked = count(t => t.status === "BLOCKED");
  const overdue = count(t => t.status !== "COMPLETED" && t.due_date && new Date(t.due_date) < new Date());
  const rate    = total ? Math.round((done / total) * 100) : 0;
  const score   = perf.overall_score !== undefined ? Math.round(perf.overall_score) + "%" : "--%";

  const statuses = [["TODO", "To do"], ["IN_PROGRESS", "In progress"], ["BLOCKED", "Blocked"], ["COMPLETED", "Completed"]]
    .map(([key, label]) => [label, count(t => t.status === key)]);

  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    .map(p => [p[0] + p.slice(1).toLowerCase(), count(t => t.priority === p)]);

  const hasWeekly = Array.isArray(perf.weekly);
  const weekly = hasWeekly ? perf.weekly : [3, 7, 4, 9, 8, 2, 5];

  setSection(`
    ${pageHead("Performance", "A productive week, one step at a time.")}

    <div class="kpis">
      ${kpi("Overall score", score, "From your analytics")}
      ${kpi("Completion rate", rate + "%", `${done} of ${total} tasks`)}
      ${kpi("Overdue", overdue, "Not completed, past due")}
      ${kpi("Blocked", blocked, "Waiting on something")}
    </div>

    <div class="split">
      <section class="card glass">
        <div class="card-head"><h2>Weekly velocity</h2><span class="chip push">${hasWeekly ? "Live" : "Sample curve"}</span></div>
        <div id="perfChart" class="ridge"></div>
      </section>

      <section class="card glass">
        <div class="card-head"><h2>Tasks by status</h2></div>
        ${barRows(statuses, total)}
        <div class="card-head" style="margin-top:18px"><h2>Tasks by priority</h2></div>
        ${barRows(priorities, total)}
      </section>
    </div>
  `);

  if (window.DaylightChart) DaylightChart.render(weekly, undefined, "perfChart");
}

function barRows(items, total) {
  if (!total) return emptyState("No tasks yet.");
  return items.map(([label, n]) => `
    <div class="bar-row">
      <span>${esc(label)}</span>
      <div class="bar"><i style="width:${Math.round((n / total) * 100)}%"></i></div>
      <b>${n}</b>
    </div>`).join("");
}

registerSection("performance", renderPerformanceSection);