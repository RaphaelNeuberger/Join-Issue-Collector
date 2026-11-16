/**
 * @fileoverview Request form (Figma "Request"). Validates the stakeholder's
 *               input and posts it to the n8n webhook "Join Web Request",
 *               which runs the same pipeline as the email collector
 *               (rate limit -> AI -> Triage ticket -> confirmation mail).
 * @module request
 */

/** @constant {string} Production URL of the n8n webhook */
const N8N_REQUEST_WEBHOOK = "https://n8n.newmountains.it/webhook/join-request";

/** @constant {Object<string, string>} Messages for server-side validation errors */
const FIELD_ERROR_MESSAGES = {
  name: "Please enter your name (at least 2 characters).",
  email: "Please enter a valid email address.",
  own_email: "Please use your own email address - this one belongs to the Join team.",
  subject: "Please enter a subject (at least 3 characters).",
  message: "Please describe your request (at least 10 characters).",
};

/** @constant {RegExp} Pragmatic email check (server validates again) */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** @constant {number} Milliseconds before the form gives up on the webhook */
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Reads and trims all form values.
 * @param {HTMLFormElement} form - The request form
 * @returns {{name: string, email: string, subject: string, message: string, website: string}}
 */
function readRequestForm(form) {
  const data = new FormData(form);
  const get = (key) => String(data.get(key) || "").trim();
  return {
    name: get("name"),
    email: get("email"),
    subject: get("subject"),
    message: get("message"),
    website: get("website"),
  };
}

/**
 * Validates the values and marks invalid fields via aria-invalid.
 * @param {HTMLFormElement} form - The request form
 * @param {ReturnType<typeof readRequestForm>} values - Trimmed values
 * @returns {string} Error message, empty when everything is valid
 */
function validateRequest(form, values) {
  const checks = [
    ["name", values.name.length >= 2, "Please enter your name."],
    ["email", EMAIL_PATTERN.test(values.email), "Please enter a valid email address."],
    ["subject", values.subject.length >= 3, "Please enter a subject."],
    ["message", values.message.length >= 10, "Please describe your request (at least 10 characters)."],
  ];
  let firstError = "";
  checks.forEach(([field, ok, message]) => {
    const input = form.elements.namedItem(field);
    if (input) input.setAttribute("aria-invalid", ok ? "false" : "true");
    if (!ok && !firstError) {
      firstError = message;
      if (input) input.focus();
    }
  });
  return firstError;
}

/**
 * Shows or hides the inline error message.
 * @param {string} message - Error text; empty hides the element
 */
function setRequestError(message) {
  const el = document.getElementById("requestError");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

/**
 * Shows the toast for a few seconds (same pattern as the sign-up toast).
 * @param {string} message - Text to show
 */
function showRequestToast(message) {
  const toast = document.getElementById("requestToast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showRequestToast.timer);
  showRequestToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

/**
 * Posts the request to n8n with a timeout.
 * @async
 * @param {ReturnType<typeof readRequestForm>} values - Validated values
 * @returns {Promise<{ok: boolean, status: number, body: Object}>}
 */
async function postRequest(values) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(N8N_REQUEST_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Maps the webhook response to the message shown to the stakeholder.
 * @param {{ok: boolean, status: number, body: Object}} result - Webhook result
 * @returns {string} Toast text
 */
function getResultMessage(result) {
  if (result.body && result.body.status === "limit") {
    return "Daily limit reached - our team will review your request manually.";
  }
  if (result.body && result.body.status === "manual") {
    return "Request received - our team will review it shortly.";
  }
  if (result.ok) return "Your request has been sent successfully!";
  return "";
}

/**
 * Returns the message for a validation error reported by the server.
 * @param {{ok: boolean, status: number, body: Object}} result - Webhook result
 * @returns {string} Error text, empty if the server did not reject a field
 */
function getFieldErrorMessage(result) {
  const field = result.body && result.body.status === "invalid" && result.body.field;
  if (!field) return "";
  return FIELD_ERROR_MESSAGES[field] || "Please check your input.";
}

/**
 * Handles the submit event: validate, send, give feedback.
 * @async
 * @param {SubmitEvent} event - Form submit event
 */
async function onRequestSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("requestSubmit");
  const values = readRequestForm(form);

  if (values.website) return; // honeypot filled -> silently ignore bots

  const error = validateRequest(form, values);
  setRequestError(error);
  if (error) return;

  if (button) button.disabled = true;
  try {
    const result = await postRequest(values);
    const fieldError = getFieldErrorMessage(result);
    if (fieldError) {
      setRequestError(fieldError);
      return;
    }
    const message = getResultMessage(result);
    if (!message) throw new Error(`Webhook answered ${result.status}`);
    form.reset();
    showRequestToast(message);
    window.setTimeout(() => {
      window.location.href = "stakeholder.html";
    }, 3000);
  } catch (_err) {
    setRequestError(
      "Your request could not be sent right now. Please try again in a few minutes."
    );
  } finally {
    if (button) button.disabled = false;
  }
}

/**
 * Initializes the form: submit handler and live reset of error markers.
 */
function initRequestForm() {
  const form = document.getElementById("requestForm");
  if (!form) return;
  form.addEventListener("submit", onRequestSubmit);
  form.addEventListener("input", (event) => {
    if (event.target && event.target.hasAttribute("aria-invalid")) {
      event.target.setAttribute("aria-invalid", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", initRequestForm);
