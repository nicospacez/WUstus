// content.js
(function () {
  let reloadTimeoutId = null;

  // 1) Detect the current course by <span title="PI">
  const courseNameEl = document.querySelector('span[title="PI"]');
  const courseName = courseNameEl?.textContent.trim() || "Unknown Course";

  // 2) Merge LVA numbers
  const table = document.querySelector("table.b3k-data");
  if (table) {
    const scrapedLvaNumbers = Array.from(
      table.querySelectorAll('td.ver_id a[href*="I="]')
    ).map((a) => a.textContent.trim());

    if (scrapedLvaNumbers.length > 0) {
      chrome.storage.local.get(["courses"], (data) => {
        const courses = data.courses || {};
        const existing = courses[courseName] || [];
        const merged = Array.from(new Set([...existing, ...scrapedLvaNumbers]));
        courses[courseName] = merged;

        chrome.storage.local.set({ courses }, () => {
          console.log(
            `Saved/merged ${merged.length} LVA numbers for "${courseName}":`,
            merged
          );
        });
      });
    }
  }

  // 3) Visualize selected LVAs
  visualizePositions();

  // 4) Listen for changes => re-visualize or re-schedule
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.selectedList || changes.courses) {
        visualizePositions();
      }
      if (changes.courseTimes) {
        scheduleRefresh(courseName);
      }
    }
  });

  // 5) Schedule the refresh once on load
  scheduleRefresh(courseName);

  function visualizePositions() {
    chrome.storage.local.get(["selectedList"], (data) => {
      const allSelected = data.selectedList || {};
      const selected = allSelected[courseName] || [];
      annotateTable(selected);
    });
  }

  function annotateTable(selectedList) {
    if (!table) return;
    const links = table.querySelectorAll('td.ver_id a[href*="I="]');
    links.forEach((link) => {
      removeOldPositionLabel(link);

      const lvaNumber = link.textContent.trim();
      const posIndex = selectedList.indexOf(lvaNumber);
      if (posIndex >= 0) {
        const label = document.createElement("span");
        label.className = "wustus-position-label";
        label.textContent = `#${posIndex + 1}`;
        Object.assign(label.style, {
          padding: "2px 6px",
          marginLeft: "4px",
          backgroundColor: "#ffd700",
          color: "#000",
          borderRadius: "4px",
          fontSize: "0.8em",
          fontWeight: "bold",
        });
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

  /**
   * scheduleRefresh: load date/time from courseTimes[courseName],
   * parse it with milliseconds, set setTimeout() => reload
   */
  function scheduleRefresh(courseName) {
    // clear any old timer
    if (reloadTimeoutId) {
      clearTimeout(reloadTimeoutId);
      reloadTimeoutId = null;
    }

    chrome.storage.local.get(["courseTimes"], (data) => {
      const courseTimes = data.courseTimes || {};
      const targetObj = courseTimes[courseName];
      if (!targetObj) return;

      // targetObj: { date: "2025-02-03", time: "14:05:27.123" } or "14:05:27.000"
      const dateVal = targetObj.date; // "YYYY-MM-DD"
      const timeVal = targetObj.time; // "HH:MM:SS.sss"
      if (!dateVal || !timeVal) return;

      const dateTime = parseDateTimeString(dateVal, timeVal);
      if (!dateTime) return;

      const now = Date.now();
      const diff = dateTime.getTime() - now;
      if (diff <= 0) {
        // time has passed
        return;
      }

      // set a precise timer
      reloadTimeoutId = setTimeout(() => {
        console.log(`Reloading for ${courseName} at ${dateTime.toISOString()}`);
        window.location.reload();
      }, diff);

      console.log(
        `Scheduled reload in ${diff} ms for ${courseName} at ${dateTime.toISOString()}`
      );
    });
  }

  /**
   * parseDateTimeString: combines "YYYY-MM-DD" + "HH:MM:SS.sss"
   * into a JavaScript Date object
   */
  function parseDateTimeString(dateStr, timeStr) {
    // If "14:05" => no seconds => add ":00"
    // If "14:05:27" => no ms => can be "14:05:27"
    // If "14:05:27.123"
    // We'll do an approach: new Date("2025-02-03T14:05:27.123")
    const isoString = `${dateStr}T${timeStr}`;
    // Some browsers accept that directly if timeStr is "HH:MM:SS.sss"
    // If user typed "14:05:27" we can add ".000"
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      // e.g. "14:05"
      timeStr += ":00.000"; 
    } else if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
      // e.g. "14:05:27"
      timeStr += ".000";
    }

    const finalString = `${dateStr}T${timeStr}`;
    const d = new Date(finalString);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return d;
  }
})();
