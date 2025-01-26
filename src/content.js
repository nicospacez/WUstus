// content.js
(function () {
  let reloadTimeoutId = null;
  const MAX_ATTEMPTS = 10;

  /**
   *  Helper to create or find a small "status box" on the page
   *  and append a message to it for user visibility.
   */
  function logToUser(msg, color = "blue") {
    // Try to find an existing WUstus status box
    let box = document.getElementById("wustus-status-box");
    if (!box) {
      // If none, create one
      box = document.createElement("div");
      box.id = "wustus-status-box";
      Object.assign(box.style, {
        position: "fixed",
        top: "50px",
        right: "50px",
        backgroundColor: "#f8f8f8",
        border: "2px solid #77f",
        padding: "8px",
        zIndex: 999999,
        maxWidth: "250px",
        fontFamily: "sans-serif",
        fontSize: "0.9em",
      });
      // Title
      const title = document.createElement("div");
      title.textContent = "WUstus Status";
      Object.assign(title.style, {
        fontWeight: "bold",
        marginBottom: "6px",
        color: "#333",
      });
      box.appendChild(title);

      document.body.appendChild(box);
    }
    // Add the message
    const p = document.createElement("p");
    p.textContent = msg;
    p.style.margin = "4px 0";
    p.style.color = color;
    box.appendChild(p);
  }

  /**
   * 1) Detect the current course by <span title="PI">
   */
  const courseNameEl = document.querySelector('span[title="PI"]');
  const courseName = courseNameEl?.textContent.trim() || "Unknown Course";
  logToUser(`Course detected: ${courseName}`, "green");

  /**
   * 2) Merge LVA numbers from the table into courses[courseName]
   */
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
          logToUser(
            `Found ${merged.length} LVA(s) on this page: ${merged.join(", ")}`
          );
        });
      });
    }
  }

  /**
   * 3) Visualize selected LVAs with #1, #2, etc.
   */
  visualizePositions();

  /**
   * 4) Listen for storage changes => re-visualize or re-schedule
   */
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

  /**
   * 5) On load, schedule a timed reload if the user set a future date/time
   */
  scheduleRefresh(courseName);

  /**
   * 6) Also check if the current time is already past the scheduled time => attempt registration
   */
  checkAndAttemptRegistration();

  /**************************************************************
   *                 Function Definitions
   **************************************************************/

  /**
   * visualizePositions: shows #1, #2, etc. for "selected" LVAs in the table
   */
  function visualizePositions() {
    chrome.storage.local.get(["selectedList"], (data) => {
      const allSelected = data.selectedList || {};
      const selected = allSelected[courseName] || [];
      annotateTable(selected);
    });
  }

  /**
   * annotateTable: for each row, if the LVA number is in selected[], display a badge
   */
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

  /**
   * removeOldPositionLabel: removes previously-added #1, #2, etc. badges (to avoid duplicates)
   */
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
   * parse it with ms, set setTimeout() => reload
   */
  function scheduleRefresh(courseName) {
    // Clear any existing timer
    if (reloadTimeoutId) {
      clearTimeout(reloadTimeoutId);
      reloadTimeoutId = null;
    }

    chrome.storage.local.get(["courseTimes"], (data) => {
      const courseTimes = data.courseTimes || {};
      const targetObj = courseTimes[courseName];
      if (!targetObj) return;

      // e.g. { date: "2025-02-03", time: "14:05:27.123" }
      const dateVal = targetObj.date; // "YYYY-MM-DD"
      const timeVal = targetObj.time; // "HH:MM:SS.sss"
      if (!dateVal || !timeVal) return;

      const dateTime = parseDateTimeString(dateVal, timeVal);
      if (!dateTime) return;

      const now = Date.now();
      const diff = dateTime.getTime() - now;
      if (diff <= 0) {
        // Already past => do nothing
        return;
      }

      // Set a precise timer
      reloadTimeoutId = setTimeout(() => {
        const iso = dateTime.toISOString();
        console.log(`Reloading for ${courseName} at ${iso}`);
        logToUser(`Auto-reloading now (target was ${iso})`, "green");
        window.location.reload();
      }, diff);

      logToUser(
        `Scheduled auto-reload in ${Math.round(
          diff / 1000
        )}s for ${courseName}.`,
        "purple"
      );
      console.log(
        `Scheduled reload in ${diff} ms for ${courseName} at ${dateTime.toISOString()}`
      );
    });
  }

  /**
   * parseDateTimeString: "YYYY-MM-DD" + "HH:MM(:SS(.sss))" => Date object
   */
  function parseDateTimeString(dateStr, timeStr) {
    // If "HH:MM", add ":00.000"
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      timeStr += ":00.000";
    } else if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
      // If "HH:MM:SS", add ".000"
      timeStr += ".000";
    }
    const finalString = `${dateStr}T${timeStr}`;
    const d = new Date(finalString);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return d;
  }

  /**
   * checkAndAttemptRegistration: if now >= scheduledTime => try to register up to 10 times
   */
  function checkAndAttemptRegistration() {
    chrome.storage.local.get(
      ["courseTimes", "registrationPriority", "attemptCount"],
      (data) => {
        let attemptCount = data.attemptCount || 0;
        const priorityList = data.registrationPriority || [];

        // Load scheduled date/time
        const courseTimes = data.courseTimes || {};
        const targetObj = courseTimes[courseName];
        if (!targetObj) return;

        const { date, time } = targetObj;
        if (!date || !time) return;

        const dateTime = parseDateTimeString(date, time);
        if (!dateTime) return;

        const now = Date.now();
        const targetMs = dateTime.getTime();

        // If it's still before the scheduled time, do nothing
        if (now < targetMs) {
          console.log("Not yet time for registration:", { now, targetMs });
          logToUser("Not yet time for registration...", "gray");
          return;
        }

        // If we already reached max attempts, stop
        if (attemptCount >= MAX_ATTEMPTS) {
          logToUser("Max attempts reached. Stopping.", "red");
          console.log(`Max attempts (${MAX_ATTEMPTS}) reached. Stopping.`);
          return;
        }

        const attemptNumber = attemptCount + 1;
        logToUser(`Registration Attempt #${attemptNumber}`, "orange");
        console.log(`Registration Attempt #${attemptNumber} (of ${MAX_ATTEMPTS}).`);

        // 1) Check if user is already registered ("ABmelden")
        if (isUserAlreadyRegistered()) {
          logToUser("You appear to be already registered. Stopping.", "green");
          console.log("User is already registered. Stopping attempts.");
          return;
        }

        // 2) Try "anmelden" in priority order
        if (tryAnmelden(priorityList)) {
          // We clicked => form submission => done
          return;
        }

        // 3) If no 'anmelden' found, try waitlist 'eintragen'
        if (tryWaitlist(priorityList)) {
          return;
        }

        // 4) If neither succeeded => increment attempts => reload
        attemptCount++;
        if (attemptCount < MAX_ATTEMPTS) {
          chrome.storage.local.set({ attemptCount }, () => {
            logToUser(
              `No success. Reloading... (attempt #${attemptCount})`,
              "orange"
            );
            console.log(`No success. Reloading... attemptCount=${attemptCount}`);
            window.location.reload();
          });
        } else {
          logToUser(`No success after ${attemptCount} attempts. Stopping.`, "red");
          console.log(`No success after ${attemptCount} attempts. Stopping.`);
        }
      }
    );
  }

  /** ================== Helper Functions for Registration ================== */

  /**
   * isUserAlreadyRegistered: checks if there's a link with text "ABmelden"
   */
  function isUserAlreadyRegistered() {
    const abmeldenLink = [...document.querySelectorAll(".action a")].find(
      (el) => el.textContent.trim().toLowerCase() === "abmelden"
    );
    return !!abmeldenLink;
  }

  /**
   * tryAnmelden: tries to click the first enabled "anmelden" button in priority order
   * @return {boolean} true if we clicked
   */
  function tryAnmelden(priorityList) {
    for (const lvaNumber of priorityList) {
      const row = findRowByLvaNumber(lvaNumber);
      if (!row) continue;

      const anmeldenBtn = row.querySelector(
        '.action form input[value="anmelden"]:not([disabled])'
      );
      if (anmeldenBtn) {
        logToUser(`Clicking 'anmelden' for LVA ${lvaNumber}`, "blue");
        console.log(`Clicking 'anmelden' for LVA ${lvaNumber}`);
        anmeldenBtn.click();
        return true;
      }
    }
    return false;
  }

  /**
   * tryWaitlist: tries to click the first enabled "eintragen" (waitlist) button in priority order
   * @return {boolean} true if we clicked
   */
  function tryWaitlist(priorityList) {
    for (const lvaNumber of priorityList) {
      const row = findRowByLvaNumber(lvaNumber);
      if (!row) continue;

      const waitlistBtn = row.querySelector(
        '.action form input[value="eintragen"]:not([disabled])'
      );
      if (waitlistBtn) {
        logToUser(`Clicking 'eintragen' (waitlist) for LVA ${lvaNumber}`, "blue");
        console.log(`Clicking 'eintragen' (waitlist) for LVA ${lvaNumber}`);
        waitlistBtn.click();
        return true;
      }
    }
    return false;
  }

  /**
   * findRowByLvaNumber: locate the <tr> in table.b3k-data for a given LVA number
   */
  function findRowByLvaNumber(lvaNumber) {
    if (!table) return null;
    const rows = [...table.querySelectorAll("tbody tr")];
    return rows.find((row) => {
      const link = row.querySelector("td.ver_id a[href*='I=']");
      if (!link) return false;
      return link.textContent.trim() === lvaNumber;
    });
  }
})();
