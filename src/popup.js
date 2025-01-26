document.addEventListener("DOMContentLoaded", async () => {
  // DOM references
  const currentCourseEl = document.getElementById("currentCourse");
  const resetBtn = document.getElementById("resetStorageBtn");

  const courseDateInput = document.getElementById("courseDateInput");
  const courseTimeInput = document.getElementById("courseTimeInput");
  const courseMsInput = document.getElementById("courseMsInput");
  const saveDateTimeBtn = document.getElementById("saveDateTimeBtn");

  const lvaDropdown = document.getElementById("lvaDropdown");
  const addButton = document.getElementById("addButton");
  const selectedListElement = document.getElementById("selectedList");

  let courseName = "Unknown Course";

  // The list of all LVA numbers for this course
  let allLvaNumbers = [];
  // The user's selected LVAs for this course
  let selectedLvas = [];
  // We'll store { [courseName]: { date: "", time: "", ms: 0 } }
  let reloadTimes = {};

  /********** 1) DETECT CURRENT COURSE **********/
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

  /********** 2) LOAD DATA & RENDER **********/
  function loadDataAndRender() {
    chrome.storage.local.get(["courses", "selectedList", "reloadTimes"], (data) => {
      console.log("Loaded from storage:", data);

      const courses = data.courses || {};
      allLvaNumbers = courses[courseName] || [];

      const allSelected = data.selectedList || {};
      selectedLvas = allSelected[courseName] || [];

      reloadTimes = data.reloadTimes || {};

      refreshDropdown();
      refreshSelectedList();
      loadCourseDateTime(); // Fill the date/time/ms inputs
    });
  }

  /********** 3) COURSE DATE/TIME/MS LOGIC **********/
  function loadCourseDateTime() {
    // If none is stored for this course, default to empty/zero
    const entry = reloadTimes[courseName] || { date: "", time: "", ms: 0 };

    // Populate the fields
    // - date/time inputs typically want "YYYY-MM-DD" and "HH:MM"
    // - if your user enters in a different format, you can adjust as needed
    courseDateInput.value = entry.date || "";
    courseTimeInput.value = entry.time || "";
    courseMsInput.value = entry.ms || 0;
  }

  // Called when user clicks "Save Date/Time/MS" button
  function saveCourseDateTime() {
    // read the input values
    const dateVal = courseDateInput.value; // "YYYY-MM-DD"
    const timeVal = courseTimeInput.value; // "HH:MM"
    const msVal = parseInt(courseMsInput.value, 10) || 0; // parse to integer

    reloadTimes[courseName] = {
      date: dateVal,
      time: timeVal,
      ms: msVal
    };

    // store it
    chrome.storage.local.set({ reloadTimes }, () => {
      console.log("Saved date/time/ms for", courseName, reloadTimes[courseName]);
    });
  }

  /********** 4) REFRESH DROPDOWN & SELECTED LIST (unchanged) **********/
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
      const labelSpan = document.createElement("span");
      labelSpan.textContent = lva + " ";

      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.style.marginRight = "4px";
      upButton.disabled = index === 0;
      upButton.addEventListener("click", () => moveItemUp(index));

      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.style.marginRight = "4px";
      downButton.disabled = index === selectedLvas.length - 1;
      downButton.addEventListener("click", () => moveItemDown(index));

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => removeItem(index));

      li.appendChild(labelSpan);
      li.appendChild(upButton);
      li.appendChild(downButton);
      li.appendChild(deleteButton);
      selectedListElement.appendChild(li);
    });
  }

  // Move items up/down in selected list
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
        console.log("Updated selectedList for course:", courseName, selectedLvas);
        refreshDropdown();
        refreshSelectedList();
      });
    });
  }

  /********** 5) EVENT LISTENERS **********/
  resetBtn.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      console.log("All local storage cleared.");
      loadDataAndRender();
    });
  });

  saveDateTimeBtn.addEventListener("click", () => {
    saveCourseDateTime();
  });

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
      if (changes.courses || changes.selectedList || changes.reloadTimes) {
        console.log("Storage changed:", changes);
        loadDataAndRender();
      }
    }
  });
});
