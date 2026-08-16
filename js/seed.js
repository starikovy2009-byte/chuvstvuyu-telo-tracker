import { addDays, todayMoscow } from "./dates.js";

const DEMO_NAMES = ["Анна", "Ксения", "Мария", "Елена", "Ольга", "Светлана", "Ирина", "Дарья", "Юлия", "Полина"];

function demoEntry(profileId, localDate, target, index) {
  return {
    id: `entry-${profileId}-${localDate}`,
    profileId,
    localDate,
    warmup: target >= 1,
    mfr: target >= 2,
    workout: target >= 3,
    steps: target >= 4 ? 7000 + ((index * 613) % 8000) : (target === 0 ? 2400 + index * 17 : 5200 + index * 23),
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:10:00.000Z`
  };
}

export function createDemoState() {
  const today = todayMoscow();
  const profiles = DEMO_NAMES.map((displayName, index) => {
    const joinedAt = addDays(today, -(170 - index * 7));
    return {
      id: `demo-${index + 1}`,
      displayName,
      avatarDataUrl: null,
      role: "member",
      status: index === DEMO_NAMES.length - 1 ? "removed" : "active",
      joinedAt,
      removedAt: index === DEMO_NAMES.length - 1 ? `${today}T08:00:00.000Z` : null,
      createdAt: `${joinedAt}T08:00:00.000Z`,
      updatedAt: `${today}T08:00:00.000Z`,
      demo: true
    };
  });

  const dailyEntries = [];
  profiles.forEach((profile, profileIndex) => {
    for (let offset = 0; offset < 56; offset += 1) {
      if ((offset + profileIndex) % 7 === 3) continue;
      const localDate = addDays(today, -offset);
      const tieIndex = profileIndex === 2 ? 1 : profileIndex;
      const target = (offset * 2 + tieIndex * 3) % 5;
      dailyEntries.push(demoEntry(profile.id, localDate, target, offset + tieIndex));
    }
  });

  return {
    version: 1,
    settings: { clubName: "ЧувствуЮ тело", timezone: "Europe/Moscow", seeded: true },
    session: { activeProfileId: null, mode: "guest" },
    profiles,
    dailyEntries
  };
}
