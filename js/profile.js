import { diffDays, formatDate, startOfWeek, endOfWeek, todayMoscow } from "./dates.js";
import { activeDays, bestDailyScore, currentStreak, membershipDays, practiceStats, profileScore } from "./scoring.js";
import { buildRanking, findRankingRow } from "./leaderboard.js";
import { activityMark, avatar, el, plural, sectionHeading } from "./ui.js";
import { prepareAvatar } from "./avatar.js";

const PRACTICES = [
  ["warmup", "Зарядка"],
  ["mfr", "МФР"],
  ["workout", "Тренировка"],
  ["steps", "7000+ шагов"]
];

function createProfileEditForm(profile, actions) {
  let nextAvatar;
  const message = el("p", { id: "profile-edit-error", className: "form-message", attrs: { role: "alert" } });
  const nameInput = el("input", { type: "text", value: profile.displayName, attrs: { minlength: "2", maxlength: "24", required: "", "aria-describedby": "profile-edit-error" } });
  const avatarInput = el("input", { type: "file", attrs: { accept: "image/jpeg,image/png,image/webp" }, on: { change: async (event) => {
    try {
      nextAvatar = await prepareAvatar(event.currentTarget.files[0]);
      message.textContent = "Новая фотография готова к сохранению";
    } catch (error) { message.textContent = error.message; }
  } } });
  const form = el("form", { className: "profile-edit", attrs: { "aria-label": "Редактирование профиля" }, on: { submit: (event) => {
    event.preventDefault();
    actions.saveProfile({ displayName: nameInput.value, ...(nextAvatar !== undefined ? { avatarDataUrl: nextAvatar } : {}) }, message);
  } } }, [
    el("label", {}, ["Имя", nameInput]),
    el("label", {}, ["Новая фотография", avatarInput]),
    el("button", { className: "button button-primary", type: "submit", text: "Сохранить" }),
    message
  ]);
  if (profile.avatarDataUrl) form.append(el("button", { className: "button button-small button-secondary", type: "button", text: "Удалить фотографию", on: { click: () => actions.saveProfile({ avatarDataUrl: null }, message) } }));
  return form;
}

export function renderProfile({ state, profile, ui, actions }) {
  const entries = state.dailyEntries;
  const allTimeRanking = buildRanking(state);
  const rank = findRankingRow(allTimeRanking, profile.id);
  const points = profileScore(entries, profile.id);
  const active = activeDays(entries, profile.id);
  const streak = currentStreak(entries, profile.id);
  const best = bestDailyScore(entries, profile.id);
  const clubDays = membershipDays(profile.joinedAt);
  const months = Math.max(1, Math.floor(clubDays / 30));
  const practices = practiceStats(entries, profile.id);
  const weekRanking = buildRanking(state, startOfWeek(todayMoscow()), endOfWeek(todayMoscow()));
  const weekRank = findRankingRow(weekRanking, profile.id)?.rank || 0;
  const root = el("article", { className: "page-view profile-page" });
  const profileAvatar = avatar(profile);
  profileAvatar.classList.add("profile-avatar-display");
  const avatarWrap = el("div", { className: "profile-avatar-wrap" }, [profileAvatar,
    el("button", {
      className: "icon-button",
      type: "button",
      text: "✎",
      attrs: { "aria-label": ui.profileEditing ? "Закрыть редактирование" : "Изменить фотографию", "aria-expanded": String(ui.profileEditing) },
      on: { click: () => actions.toggleEdit(!ui.profileEditing) }
    })
  ]);
  const identityChildren = [
    avatarWrap,
    el("div", {}, [el("p", { className: "eyebrow", text: "Мой профиль" }), el("h1", { text: profile.displayName }), el("p", { className: "muted", text: `в клубе с ${formatDate(profile.joinedAt, { year: true })}` })])
  ];
  if (ui.profileEditing) identityChildren.push(createProfileEditForm(profile, actions));
  root.append(el("section", { className: "profile-hero" }, [
    el("div", { className: "profile-identity" }, identityChildren),
    el("div", { className: "profile-meta" }, [
      el("div", { className: "profile-meta-cell" }, [el("span", { text: "Место в клубе" }), el("strong", { text: `${String(rank?.rank || 0).padStart(2, "0")} из ${allTimeRanking.length}` })]),
      el("div", { className: "profile-meta-cell" }, [el("span", { text: "Всего баллов" }), el("strong", { text: points })])
    ])
  ]));
  root.append(el("section", { className: "profile-stats" }, [
    [active, plural(active, ["активный день", "активных дня", "активных дней"])],
    [streak, plural(streak, ["день подряд", "дня подряд", "дней подряд"])],
    [`${best}/4`, "лучший день"],
    [months, plural(months, ["месяц в клубе", "месяца в клубе", "месяцев в клубе"])]
  ].map(([value, label]) => el("div", { className: "profile-stat" }, [el("strong", { text: value }), el("span", { text: label })]))));
  const content = el("div", { className: "profile-content" });
  const rhythm = el("section", { className: "profile-rhythm" }, [sectionHeading("Мой ритм", "за всё время")]);
  PRACTICES.forEach(([key, title]) => {
    const value = practices[key];
    const percentage = practices.totalEntries ? Math.round(value / practices.totalEntries * 100) : 0;
    rhythm.append(el("div", { className: "practice-row" }, [
      activityMark(key, "practice-icon"),
      el("div", {}, [
        el("div", { className: "practice-title" }, [el("span", { text: title }), el("span", { text: `${value} из ${practices.totalEntries} дней` })]),
        el("div", { className: "practice-track", attrs: { role: "progressbar", "aria-label": title, "aria-valuemin": "0", "aria-valuemax": String(practices.totalEntries), "aria-valuenow": String(value) } }, [el("span", { attrs: { style: `width:${percentage}%` } })])
      ]),
      el("strong", { text: value })
    ]));
  });
  const side = el("aside", { className: "profile-side" });
  const achievements = el("section", { className: "achievements" }, [sectionHeading("Достижения", "3 награды")]);
  [
    ["✦", `${streak} ${plural(streak, ["день", "дня", "дней"])} в ритме`, "личная серия"],
    ["●", points >= 100 ? "100 баллов" : `${points} из 100 баллов`, points >= 100 ? "новая отметка" : "на пути к отметке"],
    ["★", weekRank > 0 && weekRank <= 3 ? "Герой недели" : "Ритм недели", weekRank ? `${weekRank} место сейчас` : "начните с одной отметки"]
  ].forEach(([mark, title, subtitle]) => achievements.append(el("div", { className: "badge-row" }, [el("span", { className: "badge-mark", text: mark }), el("div", {}, [el("strong", { text: title }), el("small", { text: subtitle })])] )));
  side.append(achievements, el("div", { className: "profile-actions" }, [
    el("button", { className: "button button-primary", type: "button", text: "Редактировать профиль", on: { click: () => actions.toggleEdit(!ui.profileEditing) } }),
    el("button", { className: "button button-secondary", type: "button", text: "Выйти из аккаунта", on: { click: actions.logout } })
  ]));
  content.append(rhythm, side);
  root.append(content);
  return root;
}
