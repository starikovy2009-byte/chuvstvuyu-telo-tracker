import { compareDates, formatDate, formatMonth, monthGrid, startOfWeek, endOfWeek, todayMoscow } from "./dates.js";
import { dailyScore } from "./scoring.js";
import { buildRanking } from "./leaderboard.js";
import { renderDailyResults } from "./members.js";
import { activityMark, avatar, el, participantDisplayName, plural, sectionHeading } from "./ui.js";

const ACTIVITY_CONFIG = [
  { key: "warmup", number: "01", title: "Зарядка", subtitle: "утреннее движение" },
  { key: "mfr", number: "02", title: "МФР", subtitle: "работа с роллом" },
  { key: "workout", number: "03", title: "Тренировка", subtitle: "основная практика" }
];

function scorePhrase(score) {
  return [
    "Можно начать с одного небольшого действия.",
    "Первый шаг уже есть.",
    "Хороший ритм — продолжайте прислушиваться к себе.",
    "Почти полный круг заботы о теле.",
    "Полный день заботы о теле"
  ][score];
}

export function createCalendar({ month, entries, profile, selectedDate, today, onSelect, detailed = false, entriesReady = true }) {
  const root = el("div", { className: detailed ? "month-calendar" : "compact-calendar" });
  const week = el("div", { className: "calendar-week" });
  ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => week.append(el("span", { text: day })));
  const grid = el("div", { className: "calendar-grid", attrs: { "aria-label": `Календарь за ${formatMonth(month)}` } });
  monthGrid(month).forEach((dateString) => {
    if (!dateString) {
      grid.append(el("span", { className: "calendar-day empty", attrs: { "aria-hidden": "true" } }));
      return;
    }
    const entry = entriesReady ? entries.find((item) => item.profileId === profile.id && item.localDate === dateString) : null;
    const score = dailyScore(entry);
    const hasProgress = entriesReady && Boolean(entry) && score > 0;
    const isFuture = compareDates(dateString, today) > 0;
    const isIneligible = compareDates(dateString, profile.joinedAt) < 0;
    const isLoading = !entriesReady && !isFuture && !isIneligible;
    const missed = entriesReady && !hasProgress && !isFuture && !isIneligible;
    const classNames = ["calendar-day"];
    if (hasProgress) classNames.push("done");
    if (missed) classNames.push("missed");
    if (isLoading) classNames.push("loading");
    if (isFuture) classNames.push("future");
    if (isIneligible) classNames.push("ineligible");
    if (dateString === selectedDate) classNames.push("selected");
    if (dateString === today) classNames.push("today");
    const dayState = hasProgress ? `${score} из 4 баллов` : missed ? "пропущено" : isLoading ? "загружается" : "недоступно";
    const cell = el("button", {
      className: classNames.join(" "),
      type: "button",
      disabled: isFuture || isIneligible || isLoading,
      attrs: { "aria-label": `${formatDate(dateString)}${dateString === today ? ", сегодня" : ""}: ${dayState}` },
      on: { click: () => onSelect(dateString) }
    }, [el("span", { className: "day-number", text: Number(dateString.slice(-2)) })]);
    if (hasProgress && detailed) {
      const marks = el("span", { className: "calendar-marks", attrs: { "aria-hidden": "true" } });
      for (let index = 0; index < score; index += 1) marks.append(el("i"));
      cell.append(marks, el("small", { text: `${score} ${plural(score, ["балл", "балла", "баллов"])}` }));
    } else if (missed && detailed) {
      cell.append(el("small", { text: "пропущено" }));
    }
    grid.append(cell);
  });
  root.append(week, grid, el("div", { className: "calendar-legend" }, [
    el("span", {}, [el("i", { className: "legend-swatch" }), "Отмечено"]),
    el("span", {}, [el("i", { className: "legend-swatch missed" }), "Пропущено"]),
    el("span", {}, [el("i", { className: "legend-swatch future" }), "Будущий день"])
  ]));
  return root;
}

function createTracker(state, profile, selectedDate, actions, sync = { ready: true, loading: false, savingDate: "", error: "" }) {
  const existing = sync.ready ? state.dailyEntries.find((entry) => entry.profileId === profile.id && entry.localDate === selectedDate) : null;
  const saving = sync.savingDate === selectedDate;
  const canEdit = sync.ready && !sync.loading && !saving && compareDates(selectedDate, todayMoscow()) <= 0;
  const draft = {
    warmup: Boolean(existing?.warmup),
    mfr: Boolean(existing?.mfr),
    workout: Boolean(existing?.workout),
    steps: existing ? String(existing.steps ?? "") : ""
  };
  const scoreValue = el("b", { text: dailyScore(draft) });
  const phrase = el("p", { className: "score-copy", text: scorePhrase(dailyScore(draft)) });
  const scoreLabel = el("span", { className: "daily-score" }, [scoreValue, "/4 балла"]);
  const section = el("section", { className: "editorial-section tracker-section", attrs: { "aria-busy": String(sync.loading || saving) } }, [
    el("div", { className: "tracker-head" }, [el("h2", { text: "Трекер дня" }), scoreLabel]),
    phrase
  ]);
  const list = el("div", { className: "activity-list" });
  const updateVisuals = () => {
    const score = dailyScore(draft);
    scoreValue.textContent = score;
    phrase.textContent = scorePhrase(score);
    section.classList.toggle("perfect-day", score === 4);
  };
  ACTIVITY_CONFIG.forEach((config) => {
    const stateText = el("span", { className: "activity-state", text: draft[config.key] ? "готово ✓" : "отметить" });
    const card = el("button", {
      className: "activity-card",
      type: "button",
      disabled: !canEdit,
      attrs: { "aria-pressed": String(draft[config.key]) },
      on: { click: () => {
        draft[config.key] = !draft[config.key];
        card.setAttribute("aria-pressed", String(draft[config.key]));
        stateText.textContent = draft[config.key] ? "готово ✓" : "отметить";
        updateVisuals();
      } }
    }, [
      el("span", { className: "activity-number", text: config.number }),
      activityMark(config.key, "activity-icon"),
      el("span", { className: "activity-copy" }, [el("strong", { text: config.title }), el("small", { text: config.subtitle })]),
      stateText
    ]);
    list.append(card);
  });
  const stepProgress = el("span");
  const progressTrack = el("span", { className: "step-progress", attrs: { "aria-hidden": "true" } }, [stepProgress]);
  const stepsInput = el("input", {
    type: "number",
    value: draft.steps,
    disabled: !canEdit,
    attrs: { min: "0", max: "200000", step: "1", inputmode: "numeric", "aria-label": "Количество шагов" },
    on: { input: (event) => {
      draft.steps = event.currentTarget.value;
      const value = Math.max(0, Math.min(7000, Number(draft.steps || 0)));
      stepProgress.style.width = `${(value / 7000) * 100}%`;
      updateVisuals();
    } }
  });
  stepProgress.style.width = `${(Math.max(0, Math.min(7000, Number(draft.steps || 0))) / 7000) * 100}%`;
  const stepsCard = el("div", { className: "activity-card steps-card" }, [
    el("span", { className: "activity-number", text: "04" }),
    activityMark("steps", "activity-icon"),
    el("label", { className: "activity-copy" }, [el("strong", { text: "Шаги" }), el("small", { text: "цель 7 000+" }), progressTrack]),
    stepsInput
  ]);
  list.append(stepsCard);
  const saveButton = el("button", {
    className: "button button-primary",
    type: "button",
    text: saving ? "Сохраняем…" : existing ? "Обновить день" : "Зафиксировать день",
    disabled: !canEdit,
    on: { click: () => actions.save(selectedDate, draft, dailyScore(draft)) }
  });
  if (sync.loading) {
    section.append(el("p", { className: "tracker-sync-message", text: "Загружаем отметку из Supabase…", attrs: { role: "status" } }));
  } else if (saving) {
    section.append(el("p", { className: "tracker-sync-message", text: "Сохраняем и перечитываем отметку…", attrs: { role: "status" } }));
  } else if (sync.error) {
    section.append(el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: sync.error }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.retryEntries } })
    ]));
  }
  section.append(list, el("div", { className: "tracker-actions" }, [saveButton]));
  return section;
}

function clubStatus(sync, actions, loadingText) {
  if (sync.loading) return el("p", { className: "tracker-sync-message", text: loadingText, attrs: { role: "status" } });
  if (sync.error) {
    return el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: sync.error }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.retryClubData } })
    ]);
  }
  return null;
}

function createLeaderboard(title, ranking, activeProfileId, sync, actions) {
  const section = el("section", { className: "editorial-section" }, [sectionHeading(title, "баллы")]);
  const status = clubStatus(sync, actions, "Загружаем результаты недели из Supabase…");
  if (status) {
    section.append(status);
    return section;
  }
  const list = el("div", { className: "leaderboard" });
  const rankingProfiles = ranking.map((row) => row.profile);
  const visible = ranking.filter((row) => row.rank <= 3 || row.profile.id === activeProfileId);
  visible.forEach((row) => {
    const isYou = row.profile.id === activeProfileId;
    list.append(el("div", { className: `leader-row${isYou ? " you" : ""}` }, [
      el("span", { className: "place", text: String(row.rank).padStart(2, "0") }),
      avatar(row.profile, isYou ? "you" : ""),
      el("strong", { text: `${participantDisplayName(row.profile, rankingProfiles)}${isYou ? " · вы" : ""}` }),
      el("span", { className: "points", text: row.points })
    ]));
  });
  if (!ranking.some((row) => row.points > 0)) list.replaceChildren(el("p", { className: "empty-state", text: "На этой неделе пока нет отметок" }));
  section.append(list);
  return section;
}

export function renderOverview({ state, clubState = state, clubSync = { ready: true, loading: false, error: "" }, profile, ui, actions, sync = { ready: true, loading: false, savingDate: "", error: "" } }) {
  const selectedDate = ui.selectedDate;
  const today = todayMoscow();
  const [selectedWeekday, selectedCalendarDate] = formatDate(selectedDate, { year: true, weekday: true }).split(", ");
  const weekStart = startOfWeek(today);
  const weekRanking = clubSync.ready ? buildRanking(clubState, weekStart, endOfWeek(today)) : [];
  const root = el("article", { className: "page-view overview-page" });
  root.append(
    el("section", { className: "hero-grid" }, [
      el("div", { className: "hero-copy" }, [
        el("h1", {}, [
          el("span", { text: "Движение видно." }),
          el("span", { text: "Прогресс чувствуется." })
        ]),
        el("p", { className: "intro" }, [
          el("span", { text: "Отмечайте практики, замечайте ритм месяца и поддерживайте друг друга." })
        ]),
        el("strong", { className: "overview-date" }, [
          el("span", { text: selectedWeekday }),
          el("span", { text: selectedCalendarDate })
        ])
      ]),
      el("div", { className: "hero-photo studio" }, [el("img", { attrs: { src: "assets/source/overview-studio.jpg", alt: "Светлый зал фитнес-студии с ковриками" } })])
    ])
  );
  const layout = el("div", { className: "editorial-layout overview-editorial-layout" });
  const trackerSection = createTracker(state, profile, selectedDate, actions, sync);
  trackerSection.classList.add("overview-tracker-section");
  const photoSection = el("section", { className: "editorial-section overview-photo-section" }, [
    el("div", { className: "photo-pair" }, [
      el("figure", {}, [el("img", { attrs: { src: "assets/source/overview-coach-full.png", alt: "Тренер выполняет практику с массажным роллом" } })])
    ])
  ]);
  const calendarSection = el("section", { className: "editorial-section overview-calendar-section" }, [
    el("div", { className: "calendar-heading" }, [el("h2", { text: formatMonth(selectedDate.slice(0, 7)) })]),
    createCalendar({ month: selectedDate.slice(0, 7), entries: state.dailyEntries, profile, selectedDate, today, onSelect: actions.selectDate, entriesReady: sync.ready })
  ]);
  const weekSection = createLeaderboard("Герои недели", weekRanking, profile.id, clubSync, actions);
  weekSection.classList.add("overview-week-section");
  const resultsSection = el("section", { className: "editorial-section" }, [sectionHeading("Результаты клуба", formatDate(ui.resultsDate))]);
  const dateInput = el("input", {
    type: "date",
    value: ui.resultsDate,
    attrs: { max: today, "aria-label": "Дата результатов клуба" },
    on: { change: (event) => actions.changeResultsDate(event.currentTarget.value) }
  });
  resultsSection.append(el("div", { className: "club-results-filter" }, [el("label", {}, ["Дата", dateInput])]));
  const resultsStatus = clubStatus(clubSync, actions, "Загружаем результаты клуба из Supabase…");
  if (resultsStatus) resultsSection.append(resultsStatus);
  else resultsSection.append(renderDailyResults(clubState, ui.resultsDate, profile.id));
  const resultsColumn = el("div", { className: "overview-results-column" }, [weekSection, resultsSection]);
  layout.append(trackerSection, photoSection, calendarSection, resultsColumn);
  root.append(layout);
  return root;
}
