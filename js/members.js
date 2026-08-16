import { dailyScore } from "./scoring.js";
import { avatar, el } from "./ui.js";

export function renderDailyResults(state, dateString, activeProfileId) {
  const wrap = el("div", { className: "daily-results" });
  const profiles = state.profiles.filter((profile) => profile.status === "active");
  const rows = profiles.map((profile) => ({
    profile,
    entry: state.dailyEntries.find((entry) => entry.profileId === profile.id && entry.localDate === dateString) || null
  })).sort((a, b) => dailyScore(b.entry) - dailyScore(a.entry) || a.profile.displayName.localeCompare(b.profile.displayName, "ru"));

  rows.forEach(({ profile, entry }) => {
    const score = dailyScore(entry);
    const statuses = [
      Boolean(entry?.warmup),
      Boolean(entry?.mfr),
      Boolean(entry?.workout),
      Number(entry?.steps || 0) >= 7000
    ];
    const row = el("div", { className: `daily-result-row${profile.id === activeProfileId ? " you" : ""}` }, [
      avatar(profile, profile.id === activeProfileId ? "you" : ""),
      el("strong", { text: `${profile.displayName}${profile.id === activeProfileId ? " · вы" : ""}` }),
      ...statuses.map((done, index) => el("span", {
        className: `activity-dot${done ? " done" : ""}`,
        text: done ? "✓" : "–",
        attrs: { "aria-label": `${["Зарядка", "МФР", "Тренировка", "7000 шагов"][index]}: ${done ? "выполнено" : "не отмечено"}` }
      })),
      el("b", { text: `${score}/4` })
    ]);
    wrap.append(row);
  });
  return wrap;
}
