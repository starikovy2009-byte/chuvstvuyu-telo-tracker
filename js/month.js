import { addMonths, compareDates, formatDate, formatMonth, startOfMonth, endOfMonth, todayMoscow } from "./dates.js";
import { dailyScore, entriesInPeriod, totalScore } from "./scoring.js";
import { MAX_DAILY_SCORE } from "./daily-entry-values.js";
import { buildRanking } from "./leaderboard.js";
import { createCalendar } from "./tracker.js";
import { avatar, el, participantDisplayName, plural, sectionHeading } from "./ui.js";

function starsSection(ranking, activeProfileId, sync, actions) {
  const section = el("section", { className: "editorial-section" }, [sectionHeading("Звёзды месяца", "баллы")]);
  if (sync.loading) {
    section.append(el("p", { className: "tracker-sync-message", text: "Загружаем рейтинг месяца из Supabase…", attrs: { role: "status" } }));
    return section;
  }
  if (sync.error) {
    section.append(el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: sync.error }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.retryClubData } })
    ]));
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
      el("strong", {}, [
        `${participantDisplayName(row.profile, rankingProfiles)}${isYou ? " · вы" : ""}`,
        el("small", { text: `${row.activeDays} ${plural(row.activeDays, ["активный день", "активных дня", "активных дней"])}` })
      ]),
      el("span", { className: "points", text: row.points })
    ]));
  });
  if (!ranking.some((row) => row.points > 0)) list.replaceChildren(el("p", { className: "empty-state", text: "В этом месяце пока нет отметок" }));
  section.append(list);
  return section;
}

export function renderMonth({ state, clubState = state, clubSync = { ready: true, loading: false, error: "" }, profile, ui, actions, sync = { ready: true, loading: false, error: "" } }) {
  const month = ui.monthCursor;
  const today = todayMoscow();
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const ownEntries = entriesInPeriod(state.dailyEntries, profile.id, start, end);
  const ownPoints = totalScore(ownEntries);
  const eligibleEnd = compareDates(end, today) > 0 ? today : end;
  const eligibleStart = compareDates(start, profile.joinedAt) < 0 ? profile.joinedAt : start;
  const eligibleCount = compareDates(eligibleStart, eligibleEnd) <= 0
    ? Math.round((Date.parse(`${eligibleEnd}T00:00:00Z`) - Date.parse(`${eligibleStart}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const markedDates = new Set(ownEntries.filter((entry) => dailyScore(entry) > 0).map((entry) => entry.localDate));
  const missed = Math.max(0, eligibleCount - markedDates.size);
  const ranking = clubSync.ready ? buildRanking(clubState, start, end) : [];
  const nextMonth = addMonths(month, 1);
  const root = el("article", { className: "page-view month-page" });
  root.append(el("section", { className: "month-hero" }, [
    el("div", { className: "month-title" }, [
      el("div", {}, [el("p", { className: "eyebrow", text: "Мой месяц" }), el("h1", { text: formatMonth(month) })]),
      el("div", { className: "month-score" }, [el("strong", { text: sync.ready ? ownPoints : "—" }), el("span", { text: "баллов за месяц" })])
    ]),
    el("div", { className: "month-photo" }, [el("img", { attrs: { src: "assets/source/month-hero-studio.png", alt: "Групповое занятие в светлом зале клуба" } })])
  ]));
  const layout = el("div", { className: "editorial-layout" });
  const calendarSide = el("section", { className: "editorial-column editorial-section" });
  const previous = el("button", { className: "icon-button", type: "button", text: "←", attrs: { "aria-label": "Предыдущий месяц" }, on: { click: () => actions.changeMonth(addMonths(month, -1)) } });
  const next = el("button", { className: "icon-button", type: "button", text: "→", disabled: compareDates(`${nextMonth}-01`, `${today.slice(0, 7)}-01`) > 0, attrs: { "aria-label": "Следующий месяц" }, on: { click: () => actions.changeMonth(nextMonth) } });
  const rhythmMeta = sync.ready
    ? `${markedDates.size} ${plural(markedDates.size, ["отмеченный день", "отмеченных дня", "отмеченных дней"])} · ${missed} ${plural(missed, ["пропуск", "пропуска", "пропусков"])}`
    : "Загружаем отметки…";
  const calendarContent = [
    el("div", { className: "calendar-heading" }, [
      el("div", {}, [el("h2", { text: "Ритм месяца" }), el("span", { className: "muted", text: rhythmMeta })]),
      el("div", { className: "calendar-controls" }, [previous, next])
    ]),
    sync.error ? el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
      el("p", { text: sync.error }),
      el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.retryEntries } })
    ]) : null,
    sync.loading ? el("p", { className: "tracker-sync-message", text: "Загружаем отметки из Supabase…", attrs: { role: "status" } }) : null,
    createCalendar({ month, entries: state.dailyEntries, profile, selectedDate: ui.selectedDate, today, detailed: true, onSelect: actions.selectDate, entriesReady: sync.ready }),
    el("div", { className: "selected-day-info" }, [
      el("strong", { text: formatDate(ui.selectedDate, { weekday: true }) }),
      el("span", { className: "accent", text: sync.ready ? `${dailyScore(state.dailyEntries.find((entry) => entry.profileId === profile.id && entry.localDate === ui.selectedDate))} из ${MAX_DAILY_SCORE} баллов` : "Загрузка…" })
    ])
  ];
  calendarSide.append(...calendarContent.filter(Boolean));
  const side = el("aside", { className: "editorial-column month-side" }, [
    starsSection(ranking, profile.id, clubSync, actions),
    el("div", { className: "month-note" }, [
      el("img", { attrs: { src: "assets/photos/month-dumbbells-closeup.jpg", alt: "Тренер держит гантели во время тренировки" } }),
      el("p", { text: "Каждая отметка — ещё один день в контакте с телом." })
    ])
  ]);
  layout.append(calendarSide, side);
  root.append(layout);
  return root;
}
