/**
 * @fileoverview Summary page KPI (Key Performance Indicator) functionality
 * @module summary_kpi
 */

(function () {
  /**
   * Initializes the KPI module and sets up Firebase listeners
   * @async
   */
  async function init() {
    if (!window.firebaseDb || !window.ref || !window.onValue) {
      setTimeout(init, 100);
      return;
    }

    if (typeof seedTasksIfEmpty === "function") {
      await seedTasksIfEmpty();
    }

    const tasksRef = window.ref(window.firebaseDb, "tasks");
    window.onValue(tasksRef, (snapshot) => {
      const val = snapshot.val() || {};
      const tasks = Object.keys(val).map((k) => ({ id: k, ...val[k] }));
      updateKPIs(tasks);
    });
  }

  /**
   * Counts tasks matching any of the given status values
   * @param {Array<Object>} tasks - Array of task objects
   * @param {...string} statusValues - Status values to match
   * @returns {number} Count of matching tasks
   */
  function countByStatus(tasks, ...statusValues) {
    return tasks.filter((t) => statusValues.some((s) => t.status === s)).length;
  }

  /**
   * Filters tasks by priority level
   * @param {Array<Object>} tasks - Array of task objects
   * @param {string} priority - Priority level to filter by
   * @returns {Array<Object>} Filtered tasks
   */
  function filterByPriority(tasks, priority) {
    const lowerPriority = priority.toLowerCase();
    return tasks.filter(
      (t) => t.priority && t.priority.toLowerCase() === lowerPriority
    );
  }

  /**
   * Updates all KPI display elements with counts
   * @param {Object} counts - Object containing KPI counts
   */
  function updateAllKPIElements(counts) {
    updateElement("kpi-todo", counts.todo);
    updateElement("kpi-done", counts.done);
    updateElement("kpi-urgent", counts.urgent);
    updateElement("kpi-progress", counts.progress);
    updateElement("kpi-feedback", counts.feedback);
    updateElement("kpi-board", counts.total);
    updateElement("kpi-email", counts.email);
  }

  /**
   * Calculates and updates all KPIs from task data
   * @param {Array<Object>} tasks - Array of task objects
   */
  function updateKPIs(tasks) {
    const counts = {
      todo: countByStatus(tasks, "todo", "To do"),
      done: countByStatus(tasks, "done", "Done"),
      progress: countByStatus(tasks, "inprogress", "inProgress", "in-progress"),
      feedback: countByStatus(
        tasks,
        "await_feedback",
        "awaitFeedback",
        "await-feedback"
      ),
      urgent: filterByPriority(tasks, "urgent").length,
      total: tasks.length,
      email: tasks.filter((t) => t.aiGenerated === true).length,
    };

    updateAllKPIElements(counts);
    updateUrgentDeadline(filterByPriority(tasks, "urgent"));
  }

  /**
   * Updates a DOM element's text content by ID
   * @param {string} id - Element ID
   * @param {string|number} value - Value to display
   */
  function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /**
   * Finds the task with the earliest due date. Deadlines from today on are
   * preferred, so a long-overdue task does not hide the next real deadline.
   * @param {Array<Object>} tasks - Array of tasks with dueDate property
   * @returns {Object} The task with earliest (upcoming) due date
   */
  function findEarliestTask(tasks) {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = tasks.filter((t) => t.dueDate >= today);
    const pool = upcoming.length ? upcoming : tasks;
    return pool.reduce((earliest, current) => {
      const currentDate = new Date(current.dueDate);
      const earliestDate = new Date(earliest.dueDate);
      return currentDate < earliestDate ? current : earliest;
    });
  }

  /**
   * Formats a date string to localized format
   * @param {string} dateStr - Date string to format
   * @returns {string} Formatted date string
   */
  function formatDeadlineDate(dateStr) {
    const date = new Date(dateStr);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  }

  /**
   * Updates the urgent deadline display element
   * @param {Array<Object>} urgentTasks - Array of urgent tasks
   */
  function updateUrgentDeadline(urgentTasks) {
    const deadlineEl = document.querySelector(".deadlinedate");
    if (!deadlineEl) return;

    if (urgentTasks.length === 0) {
      deadlineEl.textContent = "No urgent tasks";
      return;
    }

    const tasksWithDate = urgentTasks.filter((t) => t.dueDate);
    if (tasksWithDate.length === 0) {
      deadlineEl.textContent = "No deadline set";
      return;
    }

    const earliestTask = findEarliestTask(tasksWithDate);
    deadlineEl.textContent = formatDeadlineDate(earliestTask.dueDate);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
