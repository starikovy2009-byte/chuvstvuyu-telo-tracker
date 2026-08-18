import { todayMoscow } from "./dates.js";

export const uiState = {
  guestScreen: "welcome",
  memberTab: "overview",
  coachTab: "active",
  selectedDate: todayMoscow(),
  resultsDate: todayMoscow(),
  monthCursor: todayMoscow().slice(0, 7),
  profileEditing: false,
  registrationAvatarData: null,
  coachSearch: "",
  coachStatsDate: todayMoscow(),
  coachStatsMonth: todayMoscow().slice(0, 7),
  selectedCoachProfileId: null,
  historyOpen: false,
  perfectPlayed: new Set()
};

export function goToMemberTab(tab) {
  if (["overview", "month", "rating", "profile"].includes(tab)) uiState.memberTab = tab;
}

export function goToCoachTab(tab) {
  if (["active", "statistics", "removed", "data"].includes(tab)) uiState.coachTab = tab;
}

export function selectTrackerDate(dateString) {
  uiState.selectedDate = dateString;
  uiState.monthCursor = dateString.slice(0, 7);
  uiState.memberTab = "overview";
}
