// content.js
(function () {
  /************************************************
   * A) MERGE LVA DATA
   ************************************************/
  // 1) Extract the course name
  const courseNameEl = document.querySelector('span[title="PI"]');
  const courseName = courseNameEl?.textContent.trim() || "Unknown Course";

  // 2) Locate the table with class "b3k-data"
  const table = document.querySelector("table.b3k-data");
  if (!table) {
    return; // No table found => nothing to do
  }

  // 2b) Gather LVA numbers from any <a> with 'I=' in href
  const scrapedLvaNumbers = Array.from(
    table.querySelectorAll('td.ver_id a[href*="I="]')
  ).map((a) => a.textContent.trim());

  if (!scrapedLvaNumbers.length) {
    // No LVA numbers found => still schedule the refresh?
    scheduleTimedRefresh(courseName);
    return;
  }

  // 3) Merge newly scraped LVA numbers into courses[courseName]
  chrome.storage.local.get(["courses"], (data) => {
    const courses = data.courses || {};
    const existing = courses[courseName] || [];

    // Merge unique
    const merged = Array.from(new Set([...existing, ...scrapedLvaNumbers]));
    courses[courseName] = merged;

    // 4) Save results
    chrome.storage.local.set({ courses }, () => {
      console.log(
        `Saved/merged ${merged.length} total LVA numbers for course "${courseName}":`,
        merged
      );
    });
  });

  /************************************************
   * B) VISUALIZE SELECTED LVA POSITIONS
   ************************************************/
  visualizePositions();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.selectedList || changes.courses) {
        visualizePositions();
      }
      // Also re-check if user changed the scheduled time
      if (changes.courseTimes) {
        scheduleTimedRefresh(courseName);
      }
    }
  });

  function visualizePositions() {
    chrome.storage.local.get(["selectedList"], (data) => {
      const allSelected = data.selectedList || {};
      const selectedForCourse = allSelected[courseName] || [];
      annotateTable(selectedForCourse);
    });
  }

  function annotateTable(selectedListForThisCourse) {
    const links = table.querySelectorAll('td.ver_id a[href*="I="]');
    links.forEach((link) => {
      const lvaNumber = link.textContent.trim();
      const posIndex = selectedListForThisCourse.indexOf(lvaNumber);

      removeOldPositionLabel(link);

      if (posIndex >= 0) {
        const label = document.createElement("span");
        label.className = "wustus-position-label";
        label.textContent = `#${posIndex + 1}`;
        label.style.padding = "2px 6px";
        label.style.marginLeft = "4px";
        label.style.backgroundColor = "#ffd700";
        label.style.color = "#000";
        label.style.borderRadius = "4px";
        label.style.fontSize = "0.8em";
        label.style.fontWeight = "bold";

        link.insertAdjacentElement("afterend", label);
      }
    });
  }

  function removeOldPositionLabel(link) {
    if (!link.nextSibling) return;
    const next = link.nextSibling;
    if (
      next.nodeType === Node.ELEMENT_NODE &&
      next.classList.contains("wustus-position-label")
    ) {
      next.remove();
    }
  }

  /************************************************
   * C) PRECISE TIMED RELOAD
   ************************************************/
  // We'll store a reference to any existing timeout so we can clear/re-schedule
  let reloadTimeoutId = null;

  // On load, call once
  scheduleTimedRefresh(courseName);

  // scheduleTimedRefresh: if there's a user-defined date/time/ms for this course,
  // set a one-time setTimeout() that reloads at that moment.
  function scheduleTimedRefresh(courseName) {
    // Clear any old timer
    if (reloadTimeoutId) {
      clearTimeout(reloadTimeoutId);
      reloadTimeoutId = null;
    }

    chrome.storage.local.get(["courseTimes"], (data) => {
      const courseTimes = data.courseTimes || {};
      const targetObj = courseTimes[courseName];
      if (!targetObj) {
        // no scheduled time => do nothing
        return;
      }
      const targetDate = parseTargetDateTime(targetObj);
      if (!targetDate) {
        return;
      }

      const now = Date.now();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) {
        // The time is already past. We could refresh immediately or do nothing
        return;
      }

      // Set a one-time timer
      reloadTimeoutId = setTimeout(() => {
        console.log("Refreshing page at the scheduled time...");
        window.location.reload();
      }, diff);

      console.log(
        `Scheduled a reload for course "${courseName}" in ${diff} ms (at ${targetDate.toLocaleString()})`
      );
    });
  }

  // parseTargetDateTime: from { date: "YYYY-MM-DD", time: "HH:MM", ms: "123" } => a Date
  function parseTargetDateTime({ date, time, ms }) {
    if (!date || !time) return null;
    const [yyyy, mm, dd] = date.split("-");
    const [hh, min] = time.split(":");
    if (!yyyy || !mm || !dd || !hh || !min) return null;

    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
    if (ms) {
      d.setMilliseconds(parseInt(ms, 10));
    }
    return d;
  }
})();
