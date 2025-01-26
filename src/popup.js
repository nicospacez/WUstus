document.addEventListener("DOMContentLoaded", async () => {
  /***** DOM ELEMENTS *****/
  const resetBtn = document.getElementById("resetStorageBtn");
  const currentCourseEl = document.getElementById("currentCourse");

  // date/time/ms inputs + save button
  const courseDateInput = document.getElementById("courseDateInput");
  const courseTimeInput = document.getElementById("courseTimeInput");
  const courseMsInput = document.getElementById("courseMsInput");
  const saveDateTimeBtn = document.getElementById("saveDateTimeBtn");

  // LVA selection
  const lvaDropdown = document.getElementById("lvaDropdown");
  const addButton = document.getElementById("addButton");
  const selectedListElement = document.getElementById("selectedList");

  /***** STATE *****/
  let courseName = "Unknown Course";
  let allLvaNumbers = []; // from courses[courseName]
  let selectedLvas = [];  // from selectedList[courseName]
  let courseTimes = {};   // { [courseName]: { date: "YYYY-MM-DD", time: "HH:MM", ms: "123" } }

  /***** 1) DETECT CURRENT COURSE *****/
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.querySelector('span[title="PI"]');
        return el?.textContent.trim() || "Unknown Course";
      },
    });
    courseName = injectionResults[0].result;
    console.log("Detected courseName from active page:", courseName);
  } catch (err) {
    console.error("Failed to retrieve course name:", err);
  }

  currentCourseEl.textContent = courseName;

  /***** 2) LOAD DATA FROM STORAGE *****/
  function loadDataAndRender() {
    chrome.storage.local.get(
      ["courses", "selectedList", "courseTimes"],
      (data) => {
        console.log("Loaded from storage:", data);

        // courses => { "PI Distributed Systems": [ "5471", "5650", ...], ... }
        const courses = data.courses || {};
        allLvaNumbers = courses[courseName] || [];

        // selectedList => { "PI Distributed Systems": [ "5471", "5650" ], ... }
        const allSelected = data.selectedList || {};
        selectedLvas = allSelected[courseName] || [];

        // courseTimes => { "PI Distributed Systems": { date, time, ms }, ...}
        courseTimes = data.courseTimes || {};

        refreshDropdown();
        refreshSelectedList();
        renderCourseTime();
      }
    );
  }

  /***** 3) RENDER & SAVE COURSE TIME (date/time/ms) *****/
  function renderCourseTime() {
    const entry = courseTimes[courseName] || {};
    // e.g. { date: "2025-02-03", time: "14:00", ms: "500" }
    courseDateInput.value = entry.date || "";
    courseTimeInput.value = entry.time || "";
    courseMsInput.value = entry.ms || "";
  }

  function saveCourseDateTime() {
    const dateVal = courseDateInput.value;  // "YYYY-MM-DD"
    const timeVal = courseTimeInput.value;  // "HH:MM"
    const msVal = courseMsInput.value;      // "123"

    // Store in memory
    courseTimes[courseName] = { date: dateVal, time: timeVal, ms: msVal };

    // Write to storage
    chrome.storage.local.set({ courseTimes }, () => {
      console.log(
        `Saved date/time/ms for ${courseName}:`,
        courseTimes[courseName]
      );
    });
  }

  /***** 4) REFRESH DROPDOWN & SELECTED LIST *****/
  function refreshDropdown() {
    lvaDropdown.innerHTML = "";

    const unselected = allLvaNumbers.filter((num) => !selectedLvas.includes(num));
    if (!unselected.length) {
      const option = document.createElement("option");
      option.disabled = true;
      option.selected = true;
      option.textContent = "No LVA numbers available";
      lvaDropdown.appendChild(option);
      addButton.disabled = true;
    } else {
      addButton.disabled = false;
      unselected.forEach((num) => {
        const option = document.createElement("option");
        option.value = num;
        option.textContent = num;
        lvaDropdown.appendChild(option);
      });
    }
  }

  function refreshSelectedList() {
    selectedListElement.innerHTML = "";
    selectedLvas.forEach((lva, index) => {
      const li = document.createElement("li");
      li.textContent = lva + " ";

      // Up button
      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.disabled = index === 0;
      upButton.style.marginRight = "4px";
      upButton.addEventListener("click", () => moveItemUp(index));

      // Down button
      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.disabled = index === selectedLvas.length - 1;
      downButton.style.marginRight = "4px";
      downButton.addEventListener("click", () => moveItemDown(index));

      // Delete button
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => removeItem(index));

      li.appendChild(upButton);
      li.appendChild(downButton);
      li.appendChild(deleteButton);

      selectedListElement.appendChild(li);
    });
  }

  /***** 5) SELECTED LIST MANIPULATION *****/
  function moveItemUp(index) {
    if (index > 0) {
      const temp = selectedLvas[index];
      selectedLvas[index] = selectedLvas[index - 1];
      selectedLvas[index - 1] = temp;
      storeSelectedList();
    }
  }

  function moveItemDown(index) {
    if (index < selectedLvas.length - 1) {
      const temp = selectedLvas[index];
      selectedLvas[index] = selectedLvas[index + 1];
      selectedLvas[index + 1] = temp;
      storeSelectedList();
    }
  }

  function removeItem(index) {
    selectedLvas.splice(index, 1);
    storeSelectedList();
  }

  function storeSelectedList() {
    chrome.storage.local.get(["selectedList"], (data) => {
      let allSelected = data.selectedList;
      if (!allSelected || Array.isArray(allSelected)) {
        allSelected = {};
      }
      allSelected[courseName] = selectedLvas;
      chrome.storage.local.set({ selectedList: allSelected }, () => {
        console.log(
          "Updated selectedList for course:",
          courseName,
          selectedLvas
        );
        refreshDropdown();
        refreshSelectedList();
      });
    });
  }

  /***** 6) EVENT LISTENERS *****/
  // Reset all storage
  resetBtn.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      console.log("All local storage cleared.");
      loadDataAndRender();
    });
  });

  // Save date/time/ms
  saveDateTimeBtn.addEventListener("click", () => {
    saveCourseDateTime();
  });

  // Add LVA from dropdown
  addButton.addEventListener("click", () => {
    const selectedValue = lvaDropdown.value;
    if (!selectedValue) return;
    if (!selectedLvas.includes(selectedValue)) {
      selectedLvas.push(selectedValue);
      storeSelectedList();
    }
  });

  // Initial load
  loadDataAndRender();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.courses || changes.selectedList || changes.courseTimes) {
        console.log("Storage changed:", changes);
        loadDataAndRender();
      }
    }
  });
});
