document.addEventListener("DOMContentLoaded", async () => {
  /***** DOM ELEMENTS *****/
  const resetBtn = document.getElementById("resetStorageBtn");
  const currentCourseEl = document.getElementById("currentCourse");

  // For scheduled refresh
  const courseDateInput = document.getElementById("courseDateInput");
  const courseTimeInput = document.getElementById("courseTimeInput");
  const saveDateTimeBtn = document.getElementById("saveDateTimeBtn");

  // LVA selection
  const lvaDropdown = document.getElementById("lvaDropdown");
  const addButton = document.getElementById("addButton");
  const selectedListElement = document.getElementById("selectedList");

  /***** STATE *****/
  let courseName = "Unknown Course";
  let allLvaNumbers = [];
  let selectedLvas = [];
  // We'll store date/time combos here
  let courseTimes = {};

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
    console.log("Detected courseName from active tab:", courseName);
  } catch (err) {
    console.error("Failed to retrieve course name:", err);
  }

  currentCourseEl.textContent = courseName;

  /***** 2) LOAD DATA AND RENDER *****/
  function loadDataAndRender() {
    chrome.storage.local.get(["courses", "selectedList", "courseTimes"], (data) => {
      console.log("Loaded from storage:", data);

      const courses = data.courses || {};
      allLvaNumbers = courses[courseName] || [];

      const allSelected = data.selectedList || {};
      selectedLvas = allSelected[courseName] || [];

      courseTimes = data.courseTimes || {};

      refreshDropdown();
      refreshSelectedList();
      renderCourseTime();
    });
  }

  /***** 3) RENDER & SAVE COURSE TIME *****/
  function renderCourseTime() {
    const entry = courseTimes[courseName] || {};
    // e.g. { date: "2025-02-03", time: "14:05:27.123" }
    courseDateInput.value = entry.date || "";
    courseTimeInput.value = entry.time || "";
  }

  function saveCourseDateTime() {
    const dateVal = courseDateInput.value; // "YYYY-MM-DD"
    const timeVal = courseTimeInput.value; // "HH:MM:SS.sss" (with step=0.001)

    // Store
    courseTimes[courseName] = { date: dateVal, time: timeVal };
    chrome.storage.local.set({ courseTimes }, () => {
      console.log(
        `Saved date/time for ${courseName}:`,
        courseTimes[courseName]
      );
    });
  }

  /***** 4) REFRESH DROPDOWN & SELECTED LIST *****/
  function refreshDropdown() {
    lvaDropdown.innerHTML = "";
    const unselected = allLvaNumbers.filter((num) => !selectedLvas.includes(num));
    if (!unselected.length) {
      const opt = document.createElement("option");
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = "No LVA numbers available";
      lvaDropdown.appendChild(opt);
      addButton.disabled = true;
    } else {
      addButton.disabled = false;
      unselected.forEach((num) => {
        const opt = document.createElement("option");
        opt.value = num;
        opt.textContent = num;
        lvaDropdown.appendChild(opt);
      });
    }
  }

  function refreshSelectedList() {
    selectedListElement.innerHTML = "";
    selectedLvas.forEach((lva, index) => {
      const li = document.createElement("li");
      li.textContent = lva + " ";

      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.disabled = index === 0;
      upButton.style.marginRight = "4px";
      upButton.addEventListener("click", () => moveItemUp(index));

      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.disabled = index === selectedLvas.length - 1;
      downButton.style.marginRight = "4px";
      downButton.addEventListener("click", () => moveItemDown(index));

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
      [selectedLvas[index - 1], selectedLvas[index]] = [selectedLvas[index], selectedLvas[index - 1]];
      storeSelectedList();
    }
  }

  function moveItemDown(index) {
    if (index < selectedLvas.length - 1) {
      [selectedLvas[index], selectedLvas[index + 1]] = [selectedLvas[index + 1], selectedLvas[index]];
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
        console.log("Updated selectedList for", courseName, selectedLvas);
        refreshDropdown();
        refreshSelectedList();
      });
    });
  }

  /***** 6) EVENT LISTENERS *****/
  // Reset storage
  resetBtn.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      console.log("All local storage cleared.");
      loadDataAndRender();
    });
  });

  // Save date/time
  saveDateTimeBtn.addEventListener("click", () => {
    saveCourseDateTime();
  });

  // Add LVA
  addButton.addEventListener("click", () => {
    const val = lvaDropdown.value;
    if (!val) return;
    if (!selectedLvas.includes(val)) {
      selectedLvas.push(val);
      storeSelectedList();
    }
  });

  // Initial
  loadDataAndRender();

  // Listen for changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.courses || changes.selectedList || changes.courseTimes) {
        console.log("Storage changed:", changes);
        loadDataAndRender();
      }
    }
  });
});
