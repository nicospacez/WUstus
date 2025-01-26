(function () {
  // 1) Extract the course name
  const courseNameEl = document.querySelector('span[title="PI"]');
  const courseName = courseNameEl?.textContent.trim() || "Unknown Course";

  // 2) Merge newly scraped LVA numbers into courses[...] (as you already do)
  // ... your existing scraping code ...
  // 2) Locate the LVA numbers in the table
  const table = document.querySelector("table.b3k-data");
  if (!table) {
    return; // No table found
  }

  const scrapedLvaNumbers = Array.from(
    table.querySelectorAll('td.ver_id a[href*="I="]')
  ).map((a) => a.textContent.trim());

  if (!scrapedLvaNumbers.length) {
    return; // No LVA numbers found
  }

  // 3) Load existing courses from local storage, then MERGE with newly scraped data
  chrome.storage.local.get(["courses"], (data) => {
    const courses = data.courses || {};
    const existing = courses[courseName] || []; // previously stored for this course

    // Merge unique values: old + new
    const merged = Array.from(new Set([...existing, ...scrapedLvaNumbers]));
    courses[courseName] = merged;

    // 4) Save the merged results back
    chrome.storage.local.set({ courses }, () => {
      console.log(
        `Saved/merged ${merged.length} total LVA numbers for course: ${courses[courseName]}`
      );
    });
  });
  // 3) After merging, call a function to visualize positions
  visualizePositions();

  // 4) Also, listen for changes to local storage so if the user reorders items in the popup,
  //    we can update the ranks on the page instantly.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && (changes.selectedList || changes.courses)) {
      // Re-visualize the positions
      visualizePositions();
    }
  });

  /**
   * 5) The function that looks up the "selected list" from storage
   *    and annotates the table with each LVA’s position.
   */
  function visualizePositions() {
    // 5a) First, get the user's selected list from storage
    chrome.storage.local.get(["selectedList"], (data) => {
      const allSelected = data.selectedList || {};
      const selectedForCourse = allSelected[courseName] || [];
      // e.g. ["5471","5650"] in the order the user wants

      // 5b) Now update the DOM to show the position
      annotateTable(selectedForCourse);
    });
  }

  /**
   * 6) annotateTable: read the table rows, find each LVA number,
   *    and if it’s in selectedForCourse, insert a label with its rank.
   */
  function annotateTable(selectedListForThisCourse) {
    // 6a) Find the table with class "b3k-data"
    const table = document.querySelector("table.b3k-data");
    if (!table) return;

    // 6b) For each link in td.ver_id a, see if it’s in selectedListForThisCourse
    const links = table.querySelectorAll('td.ver_id a[href*="I="]');
    links.forEach((link) => {
      const lvaNumber = link.textContent.trim();
      // 6c) Find the index of this LVA in the user's selected array
      const posIndex = selectedListForThisCourse.indexOf(lvaNumber);

      // 6d) Remove any old “position” label we might have added (to avoid duplicates)
      removeOldPositionLabel(link);

      // If posIndex >= 0, the user has selected this LVA
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

        // 6e) Insert the label after the link
        // Option 1: Append inline next to the <a>
        link.insertAdjacentElement("afterend", label);
      }
    });
  }

  /**
   * 7) Removes any existing label we may have added previously (e.g. if the user reorders).
   */
  function removeOldPositionLabel(link) {
    // We look for a sibling span with class "wustus-position-label"
    // and remove it to avoid duplicates.
    if (!link.nextSibling) return;
    const next = link.nextSibling;
    if (
      next.nodeType === Node.ELEMENT_NODE &&
      next.classList.contains("wustus-position-label")
    ) {
      next.remove();
    }
  }
})();
