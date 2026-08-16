import { activeDays, profileScore } from "./scoring.js";
import { diffDays, todayMoscow } from "./dates.js";
import { avatar, el, plural } from "./ui.js";

export function buildRanking(state, start = "0000-01-01", end = "9999-12-31") {
  const periodEntries = state.dailyEntries.filter((entry) => entry.localDate >= start && entry.localDate <= end);
  const rows = state.profiles
    .filter((profile) => profile.status === "active")
    .map((profile) => ({
      profile,
      points: profileScore(state.dailyEntries, profile.id, start, end),
      activeDays: activeDays(periodEntries, profile.id)
    }))
    .sort((left, right) => right.points - left.points || left.profile.displayName.localeCompare(right.profile.displayName, "ru"));
  let previousPoints = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = row.points === previousPoints ? previousRank : index + 1;
    previousPoints = row.points;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function findRankingRow(ranking, profileId) {
  return ranking.find((row) => row.profile.id === profileId) || null;
}

export function renderRating({ state, profile, actions = {}, sync = { ready: true, loading: false, error: "" } }) {
  const ranking = sync.ready ? buildRanking(state) : [];
  const own = findRankingRow(ranking, profile.id);
  const podiumRows = ranking.filter((row) => row.rank <= 3);
  const root = el("article", { className: "page-view rating-page" });
  root.append(el("section", { className: "rating-hero" }, [
    el("div", { className: "rating-summary" }, [
      el("div", {}, [
        el("p", { className: "eyebrow", text: "Рейтинг клуба" }),
        el("h1", { text: "За всё время" }),
        own ? el("div", { className: "your-place" }, [
          el("strong", { text: String(own.rank).padStart(2, "0") }),
          el("span", { text: `ваше место · ${own.points} ${plural(own.points, ["балл", "балла", "баллов"])}` })
        ]) : null
      ])
    ]),
    el("div", { className: "rating-photo" }, [el("img", { attrs: { src: "assets/source/rating-coach.png", alt: "Тренер клуба с гантелью" } })])
  ]));
  if (sync.loading) {
    root.append(el("section", { className: "editorial-section rating-sync" }, [
      el("p", { className: "tracker-sync-message", text: "Загружаем рейтинг клуба из Supabase…", attrs: { role: "status" } })
    ]));
    return root;
  }
  if (sync.error) {
    root.append(el("section", { className: "editorial-section rating-sync" }, [
      el("div", { className: "tracker-sync-error", attrs: { role: "alert" } }, [
        el("p", { text: sync.error }),
        el("button", { className: "button button-secondary button-small", type: "button", text: "Попробовать снова", on: { click: actions.retryClubData } })
      ])
    ]));
    return root;
  }
  const podium = el("section", { className: "podium", attrs: { "aria-label": "Первые места рейтинга" } });
  podiumRows.forEach((row) => {
    const card = el("div", { className: `podium-card${row.rank === 1 ? " first" : ""}` }, [
      el("span", { className: "podium-place", text: String(row.rank).padStart(2, "0") }),
      el("div", {}, [
        avatar(row.profile),
        el("strong", { text: row.profile.displayName }),
        el("small", { text: `${row.activeDays} ${plural(row.activeDays, ["активный день", "активных дня", "активных дней"])}` }),
        el("b", { text: `${row.points} ${plural(row.points, ["балл", "балла", "баллов"])}` })
      ])
    ]);
    podium.append(card);
  });
  if (!podiumRows.length) podium.append(el("p", { className: "empty-state", text: "Пока никто не заполнил трекер" }));
  root.append(podium);
  const list = el("section", { className: "ranking-list" });
  list.append(el("div", { className: "ranking-head" }, [
    el("span", { text: "№" }), el("span"), el("span", { text: "Все участники" }), el("span", { text: "Активные дни" }), el("span", { text: "Баллы" })
  ]));
  ranking.forEach((row) => {
    const isYou = row.profile.id === profile.id;
    const clubDays = Math.max(1, diffDays(row.profile.joinedAt, todayMoscow()) + 1);
    list.append(el("div", { className: `ranking-row${isYou ? " you" : ""}` }, [
      el("span", { className: "place", text: String(row.rank).padStart(2, "0") }),
      avatar(row.profile, isYou ? "you" : ""),
      el("strong", {}, [
        `${row.profile.displayName}${isYou ? " · вы" : ""}`,
        el("small", { text: `в клубе ${clubDays} ${plural(clubDays, ["день", "дня", "дней"])}` })
      ]),
      el("span", { className: "rank-days", text: `${row.activeDays} ${plural(row.activeDays, ["день", "дня", "дней"])}` }),
      el("span", { className: "rank-points", text: row.points })
    ]));
  });
  root.append(list);
  return root;
}
