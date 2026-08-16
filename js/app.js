import { renderCoach } from "./admin.js";
import {
  clearRecoveryAddress,
  getSession,
  loadAccount,
  observeAuth,
  russianAuthError,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  updateRecoveredPassword
} from "./auth.js";
import { loadClubData } from "./club-data.js";
import { loadCoachClubData } from "./coach-data.js";
import { loadDailyEntriesForMonth, saveDailyEntry } from "./daily-entries.js";
import { renderRating } from "./leaderboard.js";
import {
  approvePendingMembership,
  loadPendingMemberships,
  rejectPendingMembership,
  removeActiveParticipant,
  restoreRemovedParticipant
} from "./memberships.js";
import { renderMonth } from "./month.js";
import { renderProfile } from "./profile.js";
import { goToCoachTab, goToMemberTab, selectTrackerDate, uiState } from "./router.js";
import {
  ensureAuthenticatedProfile,
  getState,
  initializeStore,
  subscribe,
  updateProfile,
  validateName
} from "./store.js";
import { renderOverview } from "./tracker.js";
import { clampDate, compareDates, todayMoscow } from "./dates.js";
import { el } from "./ui.js";

const refs = {
  loading: document.querySelector("#loading-screen"),
  welcome: document.querySelector("#welcome-screen"),
  auth: document.querySelector("#auth-screen"),
  accountStatus: document.querySelector("#account-status-screen"),
  accountStatusKicker: document.querySelector("#account-status-kicker"),
  accountStatusTitle: document.querySelector("#account-status-title"),
  accountStatusMessage: document.querySelector("#account-status-message"),
  memberApp: document.querySelector("#member-app"),
  coachApp: document.querySelector("#coach-app"),
  memberView: document.querySelector("#member-view"),
  coachView: document.querySelector("#coach-view"),
  memberHeaderProfile: document.querySelector("#member-header-profile"),
  coachAccountLabel: document.querySelector("#coach-account-label"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  loginMessage: document.querySelector("#login-message"),
  registrationForm: document.querySelector("#registration-form"),
  registrationName: document.querySelector("#registration-name"),
  registrationEmail: document.querySelector("#registration-email"),
  registrationPassword: document.querySelector("#registration-password"),
  registrationError: document.querySelector("#registration-error"),
  forgotForm: document.querySelector("#forgot-form"),
  forgotEmail: document.querySelector("#forgot-email"),
  forgotMessage: document.querySelector("#forgot-message"),
  resetForm: document.querySelector("#reset-form"),
  resetPassword: document.querySelector("#reset-password"),
  resetPasswordConfirm: document.querySelector("#reset-password-confirm"),
  resetMessage: document.querySelector("#reset-message"),
  toastRegion: document.querySelector("#toast-region"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmTitle: document.querySelector("#confirm-title"),
  confirmMessage: document.querySelector("#confirm-message"),
  confirmAction: document.querySelector("#confirm-action")
};

const RECOVERY_IN_ADDRESS = window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery") || window.location.search.includes("recovery=1");
const authState = {
  phase: "loading",
  view: "welcome",
  account: null,
  notice: "",
  requestId: 0
};
const coachRequestsState = {
  phase: "idle",
  items: [],
  error: "",
  message: "",
  messageType: "",
  busyUserId: null,
  requestId: 0,
  rosterPhase: "idle",
  rosterError: "",
  rosterRequestId: 0
};
const coachClubDataState = {
  state: { profiles: [], dailyEntries: [] }
};
const memberEntriesState = {
  entries: [],
  loadedMonths: new Set(),
  loadingMonth: "",
  errorMonth: "",
  error: "",
  savingDate: "",
  requestId: 0
};
const clubDataState = {
  phase: "idle",
  state: { profiles: [], dailyEntries: [] },
  error: "",
  requestId: 0
};

let latestState = initializeStore();

function hideScreens() {
  refs.loading.hidden = true;
  refs.welcome.hidden = true;
  refs.auth.hidden = true;
  refs.accountStatus.hidden = true;
  refs.memberApp.hidden = true;
  refs.coachApp.hidden = true;
}

function setMessage(node, message, success = false) {
  node.textContent = message || "";
  node.classList.toggle("success", Boolean(success && message));
}

function setFormBusy(form, busy) {
  form.setAttribute("aria-busy", String(busy));
  form.querySelectorAll("button, input").forEach((control) => {
    control.disabled = busy;
  });
}

function notify(message, action = null) {
  const toast = el("div", { className: "toast", attrs: { role: "status" } }, [el("span", { text: message })]);
  let timeoutId;
  if (action) {
    toast.append(el("button", { type: "button", text: action.label, on: { click: () => {
      clearTimeout(timeoutId);
      toast.remove();
      action.run();
    } } }));
  }
  refs.toastRegion.append(toast);
  timeoutId = window.setTimeout(() => toast.remove(), 5200);
}

function confirmAction({ title, message, confirmLabel = "Подтвердить" }) {
  const returnFocus = document.activeElement;
  refs.confirmTitle.textContent = title;
  refs.confirmMessage.textContent = message;
  refs.confirmAction.textContent = confirmLabel;
  refs.confirmDialog.returnValue = "cancel";
  refs.confirmDialog.showModal();
  refs.confirmDialog.querySelector('[value="cancel"]').focus();
  return new Promise((resolve) => {
    refs.confirmDialog.addEventListener("close", () => {
      resolve(refs.confirmDialog.returnValue === "confirm");
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
    }, { once: true });
  });
}

function showAuthView(view, notice = "") {
  authState.phase = "signed-out";
  authState.view = view;
  authState.notice = notice;
  render();
  window.requestAnimationFrame(() => {
    const firstField = { login: refs.loginEmail, register: refs.registrationName, forgot: refs.forgotEmail, reset: refs.resetPassword }[view];
    firstField?.focus();
  });
}

function renderAuth() {
  refs.auth.hidden = false;
  refs.loginForm.hidden = authState.view !== "login";
  refs.registrationForm.hidden = authState.view !== "register";
  refs.forgotForm.hidden = authState.view !== "forgot";
  refs.resetForm.hidden = authState.view !== "reset";
  if (authState.view === "login" && authState.notice) {
    setMessage(refs.loginMessage, authState.notice, true);
    authState.notice = "";
  }
}

function renderAccountStatus() {
  const membership = authState.account?.membership;
  refs.accountStatus.hidden = false;
  if (authState.phase === "pending") {
    refs.accountStatusKicker.textContent = "Регистрация завершена";
    refs.accountStatusTitle.textContent = "Заявка ожидает подтверждения тренера";
    refs.accountStatusMessage.textContent = "Вы сможете открыть трекер, когда тренер добавит вас в действующий состав клуба.";
  } else if (authState.phase === "removed" || membership?.status === "removed") {
    refs.accountStatusKicker.textContent = "Доступ закрыт";
    refs.accountStatusTitle.textContent = "Вы больше не состоите в клубе";
    refs.accountStatusMessage.textContent = "Если это произошло по ошибке, свяжитесь с тренером клуба.";
  } else {
    refs.accountStatusKicker.textContent = "Не удалось открыть кабинет";
    refs.accountStatusTitle.textContent = "Нужна повторная проверка";
    refs.accountStatusMessage.textContent = authState.notice || "Проверьте интернет и попробуйте ещё раз.";
  }
}

function hasActiveParticipantAccount(profileId = authState.account?.user?.id) {
  return authState.phase === "participant"
    && authState.account?.user?.id === profileId
    && authState.account?.membership?.role === "participant"
    && authState.account?.membership?.status === "active";
}

function resetMemberEntries() {
  memberEntriesState.requestId += 1;
  memberEntriesState.entries = [];
  memberEntriesState.loadedMonths.clear();
  memberEntriesState.loadingMonth = "";
  memberEntriesState.errorMonth = "";
  memberEntriesState.error = "";
  memberEntriesState.savingDate = "";
}

function resetClubData() {
  clubDataState.requestId += 1;
  clubDataState.phase = "idle";
  clubDataState.state = { profiles: [], dailyEntries: [] };
  clubDataState.error = "";
}

function clubDataView() {
  return {
    ready: clubDataState.phase === "ready",
    loading: clubDataState.phase === "idle" || clubDataState.phase === "loading",
    error: clubDataState.error
  };
}

async function refreshClubData({ force = false } = {}) {
  if (!hasActiveParticipantAccount()) return;
  if (!force && clubDataState.phase === "ready") return;
  const requestId = ++clubDataState.requestId;
  clubDataState.phase = "loading";
  clubDataState.error = "";
  render();
  try {
    const state = await loadClubData();
    if (requestId !== clubDataState.requestId || !hasActiveParticipantAccount()) return;
    clubDataState.state = state;
    clubDataState.phase = "ready";
  } catch (error) {
    if (requestId !== clubDataState.requestId || !hasActiveParticipantAccount()) return;
    clubDataState.state = { profiles: [], dailyEntries: [] };
    clubDataState.phase = "error";
    clubDataState.error = error.message || "Не удалось загрузить общие результаты клуба.";
  }
  if (hasActiveParticipantAccount()) render();
}

function memberEntriesView(month) {
  const ready = memberEntriesState.loadedMonths.has(month);
  const error = memberEntriesState.errorMonth === month ? memberEntriesState.error : "";
  return {
    ready,
    loading: memberEntriesState.loadingMonth === month || (!ready && !error),
    savingDate: memberEntriesState.savingDate,
    error
  };
}

async function refreshMemberEntries(month, { force = false } = {}) {
  if (!hasActiveParticipantAccount()) return;
  if (!force && memberEntriesState.loadedMonths.has(month)) return;
  const requestId = ++memberEntriesState.requestId;
  memberEntriesState.loadingMonth = month;
  memberEntriesState.errorMonth = "";
  memberEntriesState.error = "";
  render();
  try {
    const entries = await loadDailyEntriesForMonth(month);
    if (requestId !== memberEntriesState.requestId || !hasActiveParticipantAccount()) return;
    memberEntriesState.entries = memberEntriesState.entries
      .filter((entry) => entry.localDate.slice(0, 7) !== month)
      .concat(entries);
    memberEntriesState.loadedMonths.add(month);
  } catch (error) {
    if (requestId !== memberEntriesState.requestId || !hasActiveParticipantAccount()) return;
    memberEntriesState.loadedMonths.delete(month);
    memberEntriesState.errorMonth = month;
    memberEntriesState.error = error.message || "Не удалось загрузить отметки. Попробуйте ещё раз.";
  } finally {
    if (requestId === memberEntriesState.requestId) memberEntriesState.loadingMonth = "";
    if (hasActiveParticipantAccount()) render();
  }
}

function memberActions(profile) {
  return {
    selectDate(dateString) {
      if (!dateString) return;
      const selectedDate = clampDate(dateString, profile.joinedAt, todayMoscow());
      selectTrackerDate(selectedDate);
      render();
      refreshMemberEntries(selectedDate.slice(0, 7), { force: true });
    },
    async save(dateString, draft, score) {
      const month = dateString.slice(0, 7);
      if (!hasActiveParticipantAccount(profile.id)) {
        notify("Сохранять отметки может только действующий участник клуба.");
        return;
      }
      if (!memberEntriesState.loadedMonths.has(month)) {
        notify("Сначала дождитесь загрузки отметки из Supabase.");
        return;
      }
      if (compareDates(dateString, todayMoscow()) > 0) {
        notify("Будущий день нельзя заполнить заранее.");
        return;
      }
      memberEntriesState.savingDate = dateString;
      memberEntriesState.errorMonth = "";
      memberEntriesState.error = "";
      render();
      try {
        const savedEntry = await saveDailyEntry(dateString, draft);
        if (!hasActiveParticipantAccount(profile.id) || savedEntry.profileId !== profile.id) return;
        memberEntriesState.entries = memberEntriesState.entries
          .filter((entry) => !(entry.profileId === profile.id && entry.localDate === dateString));
        memberEntriesState.entries.push(savedEntry);
        memberEntriesState.loadedMonths.add(month);
        if (clubDataState.phase === "ready") {
          clubDataState.state.dailyEntries = clubDataState.state.dailyEntries
            .filter((entry) => !(entry.profileId === profile.id && entry.localDate === dateString));
          clubDataState.state.dailyEntries.push(savedEntry);
        }
        if (score === 4 && !uiState.perfectPlayed.has(`${profile.id}:${dateString}`)) {
          uiState.perfectPlayed.add(`${profile.id}:${dateString}`);
          notify("Полный день заботы о теле · 4/4");
        } else notify("Готово, день сохранён в клубном дневнике");
      } catch (error) {
        memberEntriesState.errorMonth = month;
        memberEntriesState.error = error.message || "Не удалось сохранить отметку дня.";
        notify(`Ошибка: ${memberEntriesState.error}`);
      } finally {
        memberEntriesState.savingDate = "";
        if (hasActiveParticipantAccount(profile.id)) render();
      }
    },
    retryEntries() {
      const month = uiState.memberTab === "month" ? uiState.monthCursor : uiState.selectedDate.slice(0, 7);
      refreshMemberEntries(month, { force: true });
    },
    retryClubData() {
      refreshClubData({ force: true });
    },
    changeResultsDate(dateString) {
      if (!dateString || compareDates(dateString, todayMoscow()) > 0) return;
      uiState.resultsDate = dateString;
      render();
    },
    changeMonth(monthString) {
      uiState.monthCursor = monthString;
      if (uiState.selectedDate.slice(0, 7) !== monthString) uiState.selectedDate = clampDate(`${monthString}-01`, profile.joinedAt, todayMoscow());
      render();
      refreshMemberEntries(monthString);
      refreshClubData();
    },
    toggleEdit(value) {
      uiState.profileEditing = value;
      render();
    },
    saveProfile(changes, messageNode) {
      try {
        uiState.profileEditing = false;
        updateProfile(profile.id, changes);
        notify("Локальная копия профиля сохранена");
      } catch (error) {
        uiState.profileEditing = true;
        messageNode.textContent = error.message;
      }
    },
    logout: handleSignOut
  };
}

function hasActiveCoachAccount() {
  return authState.phase === "coach"
    && authState.account?.membership?.role === "coach"
    && authState.account?.membership?.status === "active";
}

function resetCoachRequests() {
  coachRequestsState.requestId += 1;
  coachRequestsState.rosterRequestId += 1;
  coachRequestsState.phase = "idle";
  coachRequestsState.items = [];
  coachRequestsState.error = "";
  coachRequestsState.message = "";
  coachRequestsState.messageType = "";
  coachRequestsState.busyUserId = null;
  coachRequestsState.rosterPhase = "idle";
  coachRequestsState.rosterError = "";
  coachClubDataState.state = { profiles: [], dailyEntries: [] };
}

async function refreshCoachRoster() {
  if (!hasActiveCoachAccount()) return;
  const requestId = ++coachRequestsState.rosterRequestId;
  coachRequestsState.rosterPhase = "loading";
  coachRequestsState.rosterError = "";
  render();
  try {
    const state = await loadCoachClubData();
    if (requestId !== coachRequestsState.rosterRequestId || !hasActiveCoachAccount()) return;
    coachClubDataState.state = state;
    coachRequestsState.rosterPhase = "ready";
  } catch (error) {
    if (requestId !== coachRequestsState.rosterRequestId || !hasActiveCoachAccount()) return;
    coachRequestsState.rosterPhase = "error";
    coachRequestsState.rosterError = error.message || "Не удалось загрузить состав клуба из Supabase.";
  }
  if (hasActiveCoachAccount()) render();
}

async function refreshJoinRequests() {
  if (!hasActiveCoachAccount()) return;
  const requestId = ++coachRequestsState.requestId;
  coachRequestsState.phase = "loading";
  coachRequestsState.error = "";
  coachRequestsState.message = "";
  coachRequestsState.messageType = "";
  render();
  try {
    const items = await loadPendingMemberships();
    if (requestId !== coachRequestsState.requestId || !hasActiveCoachAccount()) return;
    coachRequestsState.items = items;
    coachRequestsState.phase = "ready";
  } catch (error) {
    if (requestId !== coachRequestsState.requestId || !hasActiveCoachAccount()) return;
    coachRequestsState.items = [];
    coachRequestsState.phase = "error";
    coachRequestsState.error = error.message || "Не удалось загрузить заявки на вступление.";
  }
  render();
}

async function processJoinRequest(request, operation, successMessage) {
  if (!hasActiveCoachAccount() || coachRequestsState.busyUserId) {
    notify("Действие доступно только действующему тренеру клуба.");
    return;
  }
  coachRequestsState.busyUserId = request.userId;
  coachRequestsState.message = "";
  coachRequestsState.messageType = "";
  render();
  try {
    await operation(request.userId);
    await refreshCoachRoster();
    coachRequestsState.items = coachRequestsState.items.filter((item) => item.userId !== request.userId);
    coachRequestsState.phase = "ready";
    coachRequestsState.message = successMessage;
    coachRequestsState.messageType = "success";
    notify(successMessage);
  } catch (error) {
    const message = error.message || "Не удалось обработать заявку.";
    coachRequestsState.message = message;
    coachRequestsState.messageType = "error";
    notify(`Ошибка: ${message}`);
  } finally {
    coachRequestsState.busyUserId = null;
    if (hasActiveCoachAccount()) render();
  }
}

function coachActions() {
  return {
    reloadRequests() {
      refreshJoinRequests();
      refreshCoachRoster();
    },
    reloadRoster: refreshCoachRoster,
    async approveRequest(request) {
      await processJoinRequest(request, approvePendingMembership, `Заявка участника ${request.displayName} принята — доступ в клуб открыт`);
    },
    async rejectRequest(request) {
      const confirmed = await confirmAction({
        title: "Отклонить заявку?",
        message: `${request.displayName} больше не сможет войти в клуб. Профиль и запись о членстве сохранятся.`,
        confirmLabel: "Отклонить"
      });
      if (!confirmed) return;
      await processJoinRequest(request, rejectPendingMembership, `Заявка участника ${request.displayName} отклонена`);
    },
    search(value) {
      uiState.coachSearch = value;
      render();
      requestAnimationFrame(() => {
        const field = refs.coachView.querySelector('input[type="search"]');
        field?.focus();
        field?.setSelectionRange(field.value.length, field.value.length);
      });
    },
    selectMember(profileId) {
      uiState.selectedCoachProfileId = uiState.selectedCoachProfileId === profileId ? null : profileId;
      uiState.historyOpen = false;
      render();
    },
    toggleHistory() {
      uiState.historyOpen = !uiState.historyOpen;
      render();
    },
    async remove(profile) {
      const confirmed = await confirmAction({
        title: "Удалить из клуба?",
        message: `${profile.displayName} больше не сможет войти в клуб. История отметок сохранится, и участника можно будет восстановить.`,
        confirmLabel: "Удалить из клуба"
      });
      if (!confirmed) return;
      if (coachRequestsState.busyUserId) return;
      coachRequestsState.busyUserId = profile.id;
      render();
      try {
        await removeActiveParticipant(profile.id);
        uiState.selectedCoachProfileId = null;
        await refreshCoachRoster();
        notify(`${profile.displayName} удалён из клуба`);
      } catch (error) {
        notify(`Ошибка: ${error.message || "Не удалось удалить участника."}`);
      } finally {
        coachRequestsState.busyUserId = null;
        if (hasActiveCoachAccount()) render();
      }
    },
    async restore(profile) {
      if (coachRequestsState.busyUserId) return;
      coachRequestsState.busyUserId = profile.id;
      render();
      try {
        await restoreRemovedParticipant(profile.id);
        uiState.selectedCoachProfileId = null;
        await refreshCoachRoster();
        notify(`${profile.displayName} снова в клубе — доступ восстановлен`);
      } catch (error) {
        notify(`Ошибка: ${error.message || "Не удалось вернуть участника в клуб."}`);
      } finally {
        coachRequestsState.busyUserId = null;
        if (hasActiveCoachAccount()) render();
      }
    }
  };
}

function renderMember(state) {
  const profile = state.profiles.find((item) => item.id === authState.account.user.id && item.status === "active");
  if (!profile) {
    authState.phase = "account-error";
    authState.notice = "Локальная часть профиля не подготовлена. Нажмите «Проверить ещё раз».";
    renderAccountStatus();
    return;
  }
  refs.memberApp.hidden = false;
  refs.memberHeaderProfile.textContent = `${profile.displayName} · личный кабинет`;
  refs.memberApp.querySelectorAll("[data-tab]").forEach((button) => {
    if (!button.closest(".bottom-nav")) return;
    if (button.dataset.tab === uiState.memberTab) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const actions = memberActions(profile);
  const personalState = { ...state, profiles: [profile], dailyEntries: memberEntriesState.entries.slice() };
  const sharedState = clubDataState.state;
  const sharedSync = clubDataView();
  let view;
  if (uiState.memberTab === "month") {
    view = renderMonth({ state: personalState, clubState: sharedState, clubSync: sharedSync, profile, ui: uiState, actions, sync: memberEntriesView(uiState.monthCursor) });
  } else if (uiState.memberTab === "rating") view = renderRating({ state: sharedState, profile, actions, sync: sharedSync });
  else if (uiState.memberTab === "profile") view = renderProfile({ state: personalState, profile, ui: uiState, actions });
  else view = renderOverview({ state: personalState, clubState: sharedState, clubSync: sharedSync, profile, ui: uiState, actions, sync: memberEntriesView(uiState.selectedDate.slice(0, 7)) });
  refs.memberView.replaceChildren(view);
}

function renderCoachApp() {
  refs.coachApp.hidden = false;
  refs.coachAccountLabel.textContent = `${authState.account.profile.display_name} · защищённый вход`;
  refs.coachApp.querySelectorAll("[data-coach-tab]").forEach((button) => {
    if (button.dataset.coachTab === uiState.coachTab) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  refs.coachView.replaceChildren(renderCoach({ state: coachClubDataState.state, ui: uiState, actions: coachActions(), requests: coachRequestsState }));
}

function render() {
  latestState = getState();
  hideScreens();
  if (authState.phase === "loading") refs.loading.hidden = false;
  else if (authState.phase === "participant") renderMember(latestState);
  else if (authState.phase === "coach") renderCoachApp();
  else if (["pending", "removed", "account-error"].includes(authState.phase)) renderAccountStatus();
  else if (authState.view === "welcome") refs.welcome.hidden = false;
  else renderAuth();
}

function waitForFreshAccount(delay) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

async function refreshAccount(session, { retryPending = false } = {}) {
  if (!session?.user) {
    authState.phase = "signed-out";
    authState.account = null;
    authState.view = "login";
    render();
    setMessage(refs.loginMessage, "Сеанс завершён. Войдите ещё раз — после входа сайт сразу проверит новый статус заявки.");
    return;
  }
  const requestId = ++authState.requestId;
  authState.phase = "loading";
  render();
  try {
    let account = await loadAccount(session.user);
    if (retryPending) {
      for (const delay of [350, 700]) {
        if (account.membership.status !== "pending") break;
        await waitForFreshAccount(delay);
        if (requestId !== authState.requestId) return;
        account = await loadAccount(session.user);
      }
    }
    if (requestId !== authState.requestId) return;
    authState.account = account;
    const { role, status } = account.membership;
    if (status === "pending") authState.phase = "pending";
    else if (status === "removed") authState.phase = "removed";
    else if (status === "active" && role === "coach") {
      resetCoachRequests();
      resetMemberEntries();
      resetClubData();
      uiState.coachTab = "active";
      authState.phase = "coach";
    } else if (status === "active" && role === "participant") {
      resetMemberEntries();
      resetClubData();
      const joinedAt = String(account.membership.created_at || account.profile.created_at || "").slice(0, 10);
      ensureAuthenticatedProfile(account.user.id, account.profile.display_name, joinedAt);
      uiState.memberTab = "overview";
      uiState.selectedDate = todayMoscow();
      authState.phase = "participant";
    } else {
      authState.phase = "account-error";
      authState.notice = "У аккаунта указан неизвестный статус или роль. Обратитесь к разработчику сайта.";
    }
  } catch (error) {
    if (requestId !== authState.requestId) return;
    authState.phase = "account-error";
    authState.notice = russianAuthError(error, error.message || "Не удалось загрузить аккаунт.");
  }
  render();
  if (authState.phase === "coach") {
    refreshJoinRequests();
    refreshCoachRoster();
  }
  else if (authState.phase === "participant") {
    refreshMemberEntries(uiState.selectedDate.slice(0, 7), { force: true });
    refreshClubData({ force: true });
  }
}

async function handleSignOut() {
  try { await signOut(); }
  catch (error) { notify(error.message); return; }
  authState.requestId += 1;
  authState.account = null;
  authState.phase = "signed-out";
  authState.view = "welcome";
  resetCoachRequests();
  resetMemberEntries();
  resetClubData();
  uiState.profileEditing = false;
  render();
}

document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "open-login") showAuthView("login");
  else if (action === "open-register") showAuthView("register");
  else if (action === "open-forgot") {
    refs.forgotEmail.value = refs.loginEmail.value;
    showAuthView("forgot");
  } else if (action === "back-welcome") {
    authState.phase = "signed-out";
    authState.view = "welcome";
    render();
  } else if (action === "sign-out") await handleSignOut();
  else if (action === "retry-account") {
    authState.phase = "loading";
    render();
    try { await refreshAccount(await getSession(), { retryPending: true }); }
    catch (error) {
      authState.phase = "account-error";
      authState.notice = error.message;
      render();
    }
  }

  const memberTab = event.target.closest("[data-tab]")?.dataset.tab;
  if (memberTab && authState.phase === "participant") {
    goToMemberTab(memberTab);
    render();
    if (uiState.memberTab === "overview") refreshMemberEntries(uiState.selectedDate.slice(0, 7), { force: true });
    else if (uiState.memberTab === "month") refreshMemberEntries(uiState.monthCursor);
    if (["overview", "month", "rating"].includes(uiState.memberTab)) refreshClubData({ force: true });
  }
  const coachTab = event.target.closest("[data-coach-tab]")?.dataset.coachTab;
  if (coachTab && authState.phase === "coach") {
    goToCoachTab(coachTab);
    uiState.selectedCoachProfileId = null;
    uiState.historyOpen = false;
    render();
  }
});

refs.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(refs.loginMessage, "");
  if (!refs.loginForm.reportValidity()) return;
  setFormBusy(refs.loginForm, true);
  try {
    const data = await signIn(refs.loginEmail.value, refs.loginPassword.value);
    refs.loginPassword.value = "";
    await refreshAccount(data.session);
  } catch (error) { setMessage(refs.loginMessage, error.message); }
  finally { setFormBusy(refs.loginForm, false); }
});

refs.registrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(refs.registrationError, "");
  const nameError = validateName(refs.registrationName.value);
  if (nameError) {
    setMessage(refs.registrationError, nameError);
    refs.registrationName.focus();
    return;
  }
  if (!refs.registrationForm.reportValidity()) return;
  setFormBusy(refs.registrationForm, true);
  try {
    const data = await signUp(refs.registrationName.value, refs.registrationEmail.value, refs.registrationPassword.value);
    refs.registrationPassword.value = "";
    if (data.session) await refreshAccount(data.session);
    else setMessage(refs.registrationError, "Аккаунт создан. Откройте письмо от Supabase и подтвердите email, затем вернитесь сюда и войдите.", true);
  } catch (error) { setMessage(refs.registrationError, error.message); }
  finally { setFormBusy(refs.registrationForm, false); }
});

refs.forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(refs.forgotMessage, "");
  if (!refs.forgotForm.reportValidity()) return;
  setFormBusy(refs.forgotForm, true);
  try {
    await sendPasswordReset(refs.forgotEmail.value);
    setMessage(refs.forgotMessage, "Если аккаунт с таким email существует, письмо со ссылкой уже отправлено. Проверьте также папку «Спам».", true);
  } catch (error) { setMessage(refs.forgotMessage, error.message); }
  finally { setFormBusy(refs.forgotForm, false); }
});

refs.resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(refs.resetMessage, "");
  if (!refs.resetForm.reportValidity()) return;
  if (refs.resetPassword.value !== refs.resetPasswordConfirm.value) {
    setMessage(refs.resetMessage, "Пароли не совпадают.");
    refs.resetPasswordConfirm.focus();
    return;
  }
  setFormBusy(refs.resetForm, true);
  try {
    await updateRecoveredPassword(refs.resetPassword.value);
    refs.resetForm.reset();
    await signOut();
    clearRecoveryAddress();
    showAuthView("login", "Пароль изменён. Теперь войдите с новым паролем.");
  } catch (error) { setMessage(refs.resetMessage, error.message); }
  finally { setFormBusy(refs.resetForm, false); }
});

subscribe((state) => {
  latestState = state;
  render();
});

observeAuth((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    authState.phase = "signed-out";
    authState.view = "reset";
    render();
  } else if (event === "SIGNED_OUT") {
    authState.requestId += 1;
    authState.account = null;
    authState.phase = "signed-out";
    resetCoachRequests();
    resetMemberEntries();
    resetClubData();
    if (authState.view === "reset") authState.view = "login";
    render();
  } else if (event === "SIGNED_IN" && session && RECOVERY_IN_ADDRESS) {
    authState.phase = "signed-out";
    authState.view = "reset";
    render();
  } else if (event === "SIGNED_IN" && session && authState.phase !== "participant" && authState.phase !== "coach") refreshAccount(session);
});

async function initializeAuth() {
  try {
    const session = await getSession();
    if (RECOVERY_IN_ADDRESS && session) {
      authState.phase = "signed-out";
      authState.view = "reset";
      render();
    } else if (session) await refreshAccount(session);
    else {
      authState.phase = "signed-out";
      authState.view = "welcome";
      render();
    }
  } catch (error) {
    authState.phase = "account-error";
    authState.notice = error.message;
    render();
  }
}

initializeAuth();
