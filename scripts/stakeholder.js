/**
 * @fileoverview Stakeholder landing page logic. Reads the daily AI request
 *               counter from Firebase RTDB and switches the UI between the
 *               under-limit and limit-reached states (Figma: "Stakeholder" and
 *               "Stakeholder _limit reached").
 * @module stakeholder
 */

/** @constant {number} Maximum AI-processed requests per day */
const DAILY_REQUEST_LIMIT = 10;

/**
 * Returns the current date as YYYY-MM-DD in UTC. n8n uses the same format
 * server-side so both sides read and write the same Firebase node.
 * @returns {string} Date key like "2026-05-27"
 */
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds the Firebase REST URL for the current day's rate-limit node.
 * @returns {string} URL of /rateLimits/{today}.json
 * @throws {Error} If the Firebase config is missing
 */
function getRateLimitUrl() {
  const baseUrl = window.firebaseConfig && window.firebaseConfig.databaseURL;
  if (!baseUrl) {
    throw new Error("firebaseConfig.databaseURL is not configured");
  }
  return `${baseUrl}/rateLimits/${getTodayKey()}.json`;
}

/**
 * Fetches today's request count from Firebase. Returns 0 if the node does not
 * exist yet (no requests today) or if the request fails, so the page always
 * stays usable.
 * @async
 * @returns {Promise<number>} Today's count, clamped to 0..DAILY_REQUEST_LIMIT
 */
async function fetchTodaysCount() {
  try {
    const response = await fetch(getRateLimitUrl(), { cache: "no-store" });
    if (!response.ok) return 0;
    const data = await response.json();
    const count = Number(data && data.count);
    if (!Number.isFinite(count) || count < 0) return 0;
    return Math.min(Math.floor(count), DAILY_REQUEST_LIMIT);
  } catch (_error) {
    return 0;
  }
}

/**
 * Applies the count to the UI: updates every counter (desktop header and
 * mobile title area), its colour state and which content section is visible.
 * @param {number} count - Today's request count
 */
function applyCounterState(count) {
  const limitReached = count >= DAILY_REQUEST_LIMIT;

  document.querySelectorAll("[data-counter-used]").forEach((el) => {
    el.textContent = String(count);
  });
  document.querySelectorAll("[data-counter]").forEach((el) => {
    el.dataset.state = limitReached ? "limit" : "under";
  });

  const stateUnder = document.getElementById("stateUnder");
  const stateLimit = document.getElementById("stateLimit");
  if (stateUnder) stateUnder.hidden = limitReached;
  if (stateLimit) stateLimit.hidden = !limitReached;
}

/**
 * Copies the request email address to the clipboard and reports the result
 * inside the dialog. Falls back to selecting the text when the Clipboard API
 * is unavailable (e.g. plain http).
 * @async
 */
async function copyMailAddress() {
  const address = document.getElementById("mailAddress");
  const status = document.querySelector("[data-mail-status]");
  try {
    await navigator.clipboard.writeText(address.textContent.trim());
    status.textContent = "Address copied - paste it into your email.";
  } catch (_error) {
    window.getSelection().selectAllChildren(address);
    status.textContent = "Press Ctrl+C to copy the selected address.";
  }
}

/**
 * Opens the mail dialog instead of relying on a mailto: link, because a
 * visitor without a configured mail program would otherwise see nothing.
 * @param {MouseEvent} event - Click on a "Create Email Request" button
 */
function openMailDialog(event) {
  const dialog = document.getElementById("mailDialog");
  if (!dialog || typeof dialog.showModal !== "function") return;
  event.preventDefault();
  document.querySelector("[data-mail-status]").textContent = "";
  dialog.showModal();
}

/**
 * Wires up the mail dialog: open buttons, copy button, close button and a
 * click on the backdrop.
 */
function initMailDialog() {
  const dialog = document.getElementById("mailDialog");
  if (!dialog) return;
  document.querySelectorAll("[data-mail-dialog]").forEach((btn) => {
    btn.addEventListener("click", openMailDialog);
  });
  dialog.querySelector("[data-mail-copy]").addEventListener("click", copyMailAddress);
  dialog.querySelector("[data-mail-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (isBackdropClick(event, dialog)) dialog.close();
  });
}

/**
 * Checks whether a click landed on the dialog backdrop (outside its box).
 * @param {MouseEvent} event - Click event on the dialog element
 * @param {HTMLDialogElement} dialog - The open dialog
 * @returns {boolean} True if the click was outside the dialog box
 */
function isBackdropClick(event, dialog) {
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right ||
    event.clientY < box.top || event.clientY > box.bottom;
}

/**
 * Initializes the page once the DOM is ready.
 * @async
 */
async function initStakeholderPage() {
  initMailDialog();
  applyCounterState(await fetchTodaysCount());
}

document.addEventListener("DOMContentLoaded", initStakeholderPage);
