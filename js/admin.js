import { endOfMonth, endOfWeek, formatDate, formatMonth, startOfMonth, startOfWeek, todayMoscow } from "./dates.js";
import { renderDailyResults } from "./members.js";
import { activeDays, dailyScore, latestEntry, profileScore } from "./scoring.js";
import { formatSleepHours, MAX_DAILY_SCORE } from "./daily-entry-values.js";
import { avatar, el, plural, sectionHeading } from "./ui.js";

function requestDate(value) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDate(date, { year: true }) : "дата не указана";
}

function joinRequestsBlock(requests, actions) {
  const section = el("section", {
    className: "join-requests",
    attrs: { "aria-labelledby": "join-requests-title", "aria-busy": String(requests.phase === "loading") }
  });
  const heading = el("div", { className: "join-requests-heading" }, [
    el("div", {}, [
      el("p", { className: "eyebrow", text: "Новые участники" }),
      el("h2", { id: "join-requests-title", text: "Заявки на вступление" })
    ]),
    el("div", { className: "join-requests-heading-actions" }, [
      requests.phase === "ready"
        ? el("span", { className: "status-pill", text: `${requests.items.length} ${plural(requests.items.length, ["заявка", "заявки", "заявок"])}` })
        : null,
      el("button", {
        className: "button button-secondary button-small",
        type: "button",
        text: "Обновить",
        disabled: requests.phase === "loading" || Boolean(requests.busyUserId),
        on: { click: actions.reloadRequests }
      })
    ])
  ]);
  section.append(heading);

  if (requests.message) {
    section.append(el("p", {
      className: `request-message${requests.messageType === "success" ? " success" : ""}`,
      text: requests.message,
      attrs: { role: requests.messageType === "error" ? "alert" : "status" }
    }));
  }

  if (requests.phase === "loading") {
    section.append(el("p", { className: "empty-state", text: "Загружаем заявки…" }));
    return section;
  }
  if (requests.phase === "error") {
    section.append(el("div", { className: "request-error" }, [
      el("p", { text: requests.error || "Не удалось загрузить заявки." }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.reloadRequests } })
    ]));
    return section;
  }
  if (!requests.items.length) {
    section.append(el("p", { className: "empty-state", text: "Новых заявок сейчас нет" }));
    return section;
  }

  const list = el("div", { className: "join-request-list" });
  requests.items.forEach((request) => {
    const busy = requests.busyUserId === request.userId;
    list.append(el("article", { className: "join-request-row" }, [
      el("div", { className: "join-request-person" }, [
        el("strong", { text: request.displayName }),
        el("span", { text: `Заявка от ${requestDate(request.createdAt)}` })
      ]),
      el("div", { className: "join-request-actions" }, [
        el("button", {
          className: "button button-primary button-small",
          type: "button",
          text: busy ? "Обрабатываем…" : "Принять в клуб",
          disabled: Boolean(requests.busyUserId),
          on: { click: () => actions.approveRequest(request) }
        }),
        el("button", {
          className: "button button-danger button-small",
          type: "button",
          text: "Отклонить",
          disabled: Boolean(requests.busyUserId),
          on: { click: () => actions.rejectRequest(request) }
        })
      ])
    ]));
  });
  section.append(list);
  return section;
}

function coachStats(state) {
  const today = todayMoscow();
  const activeIds = new Set(state.profiles.filter((profile) => profile.status === "active").map((profile) => profile.id));
  const filledToday = new Set(state.dailyEntries
    .filter((entry) => entry.localDate === today && activeIds.has(entry.profileId) && dailyScore(entry) > 0)
    .map((entry) => entry.profileId)).size;
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const weekPoints = state.dailyEntries
    .filter((entry) => activeIds.has(entry.profileId) && entry.localDate >= weekStart && entry.localDate <= weekEnd)
    .reduce((sum, entry) => sum + dailyScore(entry), 0);
  return { active: activeIds.size, filledToday, weekPoints };
}

function activeClubState(state) {
  const profiles = state.profiles.filter((profile) => profile.status === "active");
  const activeIds = new Set(profiles.map((profile) => profile.id));
  return {
    profiles,
    dailyEntries: state.dailyEntries.filter((entry) => activeIds.has(entry.profileId))
  };
}

export function buildCoachRanking(state, start = "0000-01-01", end = "9999-12-31") {
  const periodEntries = state.dailyEntries.filter((entry) => entry.localDate >= start && entry.localDate <= end);
  return state.profiles
    .filter((profile) => profile.status === "active")
    .map((profile) => ({
      profile,
      points: profileScore(periodEntries, profile.id),
      activeDays: activeDays(periodEntries, profile.id)
    }))
    .sort((left, right) => right.points - left.points
      || right.activeDays - left.activeDays
      || left.profile.displayName.localeCompare(right.profile.displayName, "ru"))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function coachRankingSection(title, meta, ranking, emptyText) {
  const section = el("section", { className: "coach-ranking-section", attrs: { "aria-label": title } });
  section.append(el("div", { className: "coach-statistics-section-head" }, [
    el("div", {}, [el("p", { className: "eyebrow", text: meta }), el("h2", { text: title })]),
    el("span", { className: "status-pill", text: `${ranking.length} ${plural(ranking.length, ["участник", "участника", "участников"])}` })
  ]));
  if (!ranking.length) {
    section.append(el("p", { className: "empty-state", text: emptyText }));
    return section;
  }
  const list = el("div", { className: "coach-ranking-list" });
  list.append(el("div", { className: "coach-ranking-head" }, [
    el("span", { text: "№" }), el("span"), el("span", { text: "Участник" }), el("span", { text: "Дни" }), el("span", { text: "Баллы" })
  ]));
  ranking.forEach((row) => {
    list.append(el("div", { className: "coach-ranking-row" }, [
      el("span", { className: "place", text: String(row.rank).padStart(2, "0") }),
      avatar(row.profile),
      el("strong", { text: row.profile.displayName }),
      el("span", {
        className: "coach-rank-days",
        text: row.activeDays,
        attrs: { "aria-label": `${row.activeDays} ${plural(row.activeDays, ["активный день", "активных дня", "активных дней"])}` }
      }),
      el("span", { className: "coach-rank-points", text: row.points })
    ]));
  });
  section.append(list);
  return section;
}

function statisticsPage(state, ui, actions, requests) {
  const today = todayMoscow();
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(ui.coachStatsDate) && ui.coachStatsDate <= today ? ui.coachStatsDate : today;
  const currentMonth = today.slice(0, 7);
  const selectedMonth = /^\d{4}-\d{2}$/.test(ui.coachStatsMonth) && ui.coachStatsMonth <= currentMonth ? ui.coachStatsMonth : currentMonth;
  const page = el("article", {
    className: "page-view coach-page coach-statistics-page",
    attrs: { "aria-busy": String(requests.rosterPhase === "loading") }
  }, [
    el("div", { className: "coach-statistics-title" }, [
      el("div", {}, [
        el("h1", { text: "Статистика клуба" }),
        el("p", { className: "muted", text: "Рейтинги и результаты действующих участников клуба." })
      ]),
      el("button", {
        className: "button button-secondary button-small",
        type: "button",
        text: requests.rosterPhase === "loading" ? "Обновляем…" : "Обновить данные",
        disabled: requests.rosterPhase === "loading",
        on: { click: actions.reloadRoster }
      })
    ]),
    el("div", { className: "coach-statistics-filters" }, [
      el("label", {}, [
        el("span", { text: "Дата результатов" }),
        el("input", {
          type: "date",
          value: selectedDate,
          attrs: { max: today },
          on: { change: (event) => actions.setStatsDate(event.currentTarget.value) }
        })
      ]),
      el("label", {}, [
        el("span", { text: "Месяц рейтинга" }),
        el("input", {
          type: "month",
          value: selectedMonth,
          attrs: { max: currentMonth },
          on: { change: (event) => actions.setStatsMonth(event.currentTarget.value) }
        })
      ])
    ])
  ]);

  if (requests.rosterPhase === "loading" || requests.rosterPhase === "idle") {
    page.append(el("p", { className: "tracker-sync-message", text: "Загружаем статистику клуба…", attrs: { role: "status" } }));
    return page;
  }
  if (requests.rosterPhase === "error") {
    page.append(el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: requests.rosterError || "Не удалось загрузить статистику клуба." }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.reloadRoster } })
    ]));
    return page;
  }

  const activeState = activeClubState(state);
  if (!activeState.profiles.length) {
    page.append(el("p", { className: "empty-state", text: "В клубе пока нет действующих участников для статистики." }));
    return page;
  }

  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  page.append(
    coachRankingSection(
      "Герои недели",
      `${formatDate(weekStart)} — ${formatDate(weekEnd)}`,
      buildCoachRanking(activeState, weekStart, weekEnd),
      "За текущую неделю пока нет данных."
    ),
    coachRankingSection(
      "Звёзды месяца",
      formatMonth(selectedMonth),
      buildCoachRanking(activeState, monthStart, monthEnd),
      "За выбранный месяц пока нет данных."
    )
  );

  const resultsSection = el("section", { className: "coach-ranking-section", attrs: { "aria-label": "Результаты клуба" } }, [
    el("div", { className: "coach-statistics-section-head" }, [
      el("div", {}, [el("p", { className: "eyebrow", text: formatDate(selectedDate, { year: true }) }), el("h2", { text: "Результаты клуба" })]),
      el("span", { className: "status-pill", text: `${activeState.profiles.length} ${plural(activeState.profiles.length, ["участник", "участника", "участников"])}` })
    ]),
    renderDailyResults(activeState, selectedDate, null)
  ]);
  page.append(resultsSection);
  page.append(coachRankingSection(
    "Рейтинг за всё время",
    "Полный список действующих участников",
    buildCoachRanking(activeState),
    "В рейтинге пока нет действующих участников."
  ));
  return page;
}

function memberRows(state, profiles, ui, actions, requests) {
  const list = el("div", { className: "member-list" });
  const query = ui.coachSearch.trim().toLocaleLowerCase("ru");
  const filtered = profiles.filter((profile) => profile.displayName.toLocaleLowerCase("ru").includes(query));
  filtered.forEach((profile) => {
    const last = latestEntry(state.dailyEntries, profile.id);
    const points = profileScore(state.dailyEntries, profile.id);
    const selected = ui.selectedCoachProfileId === profile.id;
    const row = el("button", {
      className: `member-row${selected ? " selected" : ""}`,
      type: "button",
      attrs: { "aria-expanded": String(selected) },
      on: { click: () => actions.selectMember(profile.id) }
    }, [
      avatar(profile),
      el("strong", {}, [profile.displayName, el("small", { text: profile.status === "active" ? "действующий участник" : "удалён из клуба" })]),
      el("span", { className: "last-active", text: last ? `активность ${formatDate(last.localDate)}` : "нет заполнений" }),
      el("span", { className: "member-points", text: `${points} б.` })
    ]);
    list.append(row);
    if (selected) list.append(memberDetail(state, profile, ui, actions, requests));
  });
  if (!filtered.length) list.append(el("p", { className: "empty-state", text: query ? "Участник с таким именем не найден" : "В этом списке пока никого нет" }));
  return list;
}

function memberDetail(state, profile, ui, actions, requests) {
  const today = todayMoscow();
  const last = latestEntry(state.dailyEntries, profile.id);
  const week = profileScore(state.dailyEntries, profile.id, startOfWeek(today), endOfWeek(today));
  const month = profileScore(state.dailyEntries, profile.id, startOfMonth(today), endOfMonth(today));
  const all = profileScore(state.dailyEntries, profile.id);
  const card = el("section", { className: "member-detail-card", attrs: { "aria-label": `Карточка участника ${profile.displayName}` } });
  card.append(el("div", { className: "member-detail-head" }, [
    avatar(profile, "avatar-lg"),
    el("div", {}, [el("h2", { text: profile.displayName }), el("p", { className: "muted", text: `В клубе с ${formatDate(profile.joinedAt, { year: true })}` })]),
    el("span", { className: `status-pill${profile.status === "removed" ? " removed" : ""}`, text: profile.status === "active" ? "Действующий" : "Удалён" })
  ]));
  card.append(el("div", { className: "member-detail-stats" }, [
    [last ? formatDate(last.localDate) : "Нет", "последняя активность"],
    [week, "баллов за неделю"],
    [month, "баллов за месяц"],
    [all, "баллов за всё время"]
  ].map(([value, label]) => el("div", { className: "member-detail-stat" }, [el("strong", { text: value }), el("span", { text: label })]))));
  if (ui.historyOpen) {
    const history = el("div", { className: "member-history" }, [sectionHeading("История участника", "последние записи", "h3")]);
    const entries = state.dailyEntries.filter((entry) => entry.profileId === profile.id).sort((a, b) => b.localDate.localeCompare(a.localDate)).slice(0, 14);
    entries.forEach((entry) => history.append(el("div", { className: "history-row" }, [
      el("span", { text: formatDate(entry.localDate, { weekday: true }) }),
      el("strong", { text: `${dailyScore(entry)}/${MAX_DAILY_SCORE} · ${Number(entry.steps || 0).toLocaleString("ru-RU")} шагов · вода ${entry.water ? "✓" : "—"} · сон ${formatSleepHours(entry.sleepHours)} ч` })
    ])));
    if (!entries.length) history.append(el("p", { className: "empty-state", text: "Участник ещё не заполнял трекер" }));
    card.append(history);
  }
  const actionBar = el("div", { className: "member-detail-actions" }, [
    el("button", { className: "button button-secondary", type: "button", text: ui.historyOpen ? "Скрыть историю" : "Открыть историю", on: { click: actions.toggleHistory } })
  ]);
  if (profile.status === "active") {
    actionBar.append(el("button", {
      className: "button button-danger",
      type: "button",
      text: requests.busyUserId === profile.id ? "Обрабатываем…" : "Удалить из клуба",
      disabled: Boolean(requests.busyUserId),
      on: { click: () => actions.remove(profile) }
    }));
  } else {
    actionBar.append(el("button", {
      className: "button button-primary",
      type: "button",
      text: requests.busyUserId === profile.id ? "Восстанавливаем…" : "Вернуть в клуб",
      disabled: Boolean(requests.busyUserId),
      on: { click: () => actions.restore(profile) }
    }));
  }
  card.append(actionBar);
  return card;
}

function membersPage(state, ui, actions, requests, status, title) {
  const page = el("article", { className: "page-view coach-page" }, [
    el("p", { className: "eyebrow", text: "Состав клуба" }),
    el("h1", { text: title }),
    el("p", { className: "muted", text: status === "active" ? "Поиск, карточки и история действующих участников." : "Профили и история сохранены — участника можно вернуть в клуб." })
  ]);
  if (requests.rosterPhase === "loading") {
    page.append(el("p", { className: "tracker-sync-message", text: "Обновляем состав клуба…", attrs: { role: "status" } }));
  } else if (requests.rosterError) {
    page.append(el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: requests.rosterError }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.reloadRoster } })
    ]));
  }
  if (status === "active") {
    page.append(joinRequestsBlock(requests, actions));
    const stats = coachStats(state);
    page.append(el("section", { className: "coach-stats", attrs: { "aria-label": "Краткая сводка клуба" } }, [
      [stats.active, plural(stats.active, ["действующий участник", "действующих участника", "действующих участников"])],
      [stats.filledToday, "заполнили сегодня"],
      [stats.weekPoints, "баллов клуба за неделю"]
    ].map(([value, label]) => el("div", { className: "coach-stat" }, [el("strong", { text: value }), el("span", { text: label })]))));
  }
  const search = el("input", {
    type: "search",
    value: ui.coachSearch,
    attrs: { placeholder: "Поиск по имени или фамилии", "aria-label": "Поиск участника по имени или фамилии" },
    on: { input: (event) => actions.search(event.currentTarget.value) }
  });
  page.append(el("div", { className: "member-toolbar" }, [search, el("span", { className: "status-pill", text: `${state.profiles.filter((profile) => profile.status === status).length} ${plural(state.profiles.filter((profile) => profile.status === status).length, ["участник", "участника", "участников"])}` })]));
  const profiles = state.profiles.filter((profile) => profile.status === status);
  page.append(memberRows(state, profiles, ui, actions, requests));
  return page;
}

function dataPage(state, actions, requests) {
  const active = state.profiles.filter((profile) => profile.status === "active").length;
  const removed = state.profiles.filter((profile) => profile.status === "removed").length;
  const page = el("article", { className: "page-view coach-page" }, [
    el("h1", { text: "Данные клуба" }),
    el("p", { className: "muted", text: "Актуальная информация о составе клуба и заполненных днях участников." })
  ]);
  if (requests.rosterPhase === "loading") {
    page.append(el("p", { className: "tracker-sync-message", text: "Обновляем данные клуба…", attrs: { role: "status" } }));
  } else if (requests.rosterError) {
    page.append(el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: requests.rosterError }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.reloadRoster } })
    ]));
  }
  page.append(el("div", { className: "data-actions" }, [
    el("section", { className: "data-card" }, [el("h2", { text: String(active) }), el("p", { text: plural(active, ["действующий участник", "действующих участника", "действующих участников"]) })]),
    el("section", { className: "data-card" }, [el("h2", { text: String(removed) }), el("p", { text: plural(removed, ["удалённый профиль", "удалённых профиля", "удалённых профилей"]) })]),
    el("section", { className: "data-card" }, [
      el("h2", { text: String(state.dailyEntries.length) }),
      el("p", { text: plural(state.dailyEntries.length, ["запись в дневнике", "записи в дневнике", "записей в дневнике"]) }),
      el("button", { className: "button button-primary", type: "button", text: requests.rosterPhase === "loading" ? "Обновляем…" : "Обновить данные", disabled: requests.rosterPhase === "loading", on: { click: actions.reloadRoster } })
    ])
  ]));
  return page;
}

export function renderCoach({ state, ui, actions, requests }) {
  if (ui.coachTab === "statistics") return statisticsPage(state, ui, actions, requests);
  if (ui.coachTab === "removed") return membersPage(state, ui, actions, requests, "removed", "Удалённые из клуба");
  if (ui.coachTab === "data") return dataPage(state, actions, requests);
  return membersPage(state, ui, actions, requests, "active", "Действующие участники");
}
