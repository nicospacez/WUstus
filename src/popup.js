// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const currentCourseEl = document.getElementById("currentCourse");
  const lvaDropdown = document.getElementById("lvaDropdown");
  const addButton = document.getElementById("addButton");
  const selectedListElement = document.getElementById("selectedList");

  let courseName = "Unknown Course";
  let allLvaNumbers = []; // from courses[courseName]
  let selectedLvas = [];  // from selectedList[courseName]

  /**
   * Detect the current course by injecting code into the active tab.
   * (Same logic as your content script to avoid mismatch.)
   */
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Adjust this selector to match your page (title="PI", etc.)
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

  /**
   * Reads data from chrome.storage, populates allLvaNumbers & selectedLvas, then updates the UI.
   */
  function loadDataAndRender() {
    chrome.storage.local.get(["courses", "selectedList"], (data) => {
      console.log("Loaded courses and selectedList from storage:", data);

      const courses = data.courses || {};
      allLvaNumbers = courses[courseName] || [];

      const allSelected = data.selectedList || {};
      selectedLvas = allSelected[courseName] || [];

      console.log("Courses object:", courses);
      console.log("Selected List object:", allSelected);
      console.log("Selected LVA numbers for this course:", selectedLvas);
      console.log("All LVA numbers for this course:", allLvaNumbers);

      refreshDropdown();
      refreshSelectedList();
    });
  }

  /**
   * Saves the current 'selectedLvas' array for this course back into chrome.storage.
   * We do this whenever we reorder or delete items, so changes persist across reopens.
   */
  function storeSelectedList() {
    chrome.storage.local.get(["selectedList"], (data) => {
      let allSelected = data.selectedList;

      // If allSelected doesn't exist or is an array, convert it to an object
      if (!allSelected || Array.isArray(allSelected)) {
        allSelected = {};
      }

      // Assign our updated array to the current course
      allSelected[courseName] = selectedLvas;

      chrome.storage.local.set({ selectedList: allSelected }, () => {
        console.log("Updated selectedList for course:", courseName, selectedLvas);
        // Re-render UI
        refreshDropdown();
        refreshSelectedList();
      });
    });
  }

  /**
   * Build or refresh the dropdown: only show unselected LVAs.
   */
  function refreshDropdown() {
    lvaDropdown.innerHTML = "";

    const unselected = allLvaNumbers.filter((num) => !selectedLvas.includes(num));

    if (unselected.length === 0) {
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

  /**
   * Refresh the <ul> that shows the user's selected LVAs.
   * We add Up/Down/Delete buttons for each item.
   */
  function refreshSelectedList() {
    selectedListElement.innerHTML = "";

    selectedLvas.forEach((lva, index) => {
      const li = document.createElement("li");

      // LVA number text
      const labelSpan = document.createElement("span");
      labelSpan.textContent = lva + " ";

      // Up button
      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.style.marginRight = "4px";
      upButton.disabled = (index === 0); 
      // If this item is at the top, can't move up
      upButton.addEventListener("click", () => {
        moveItemUp(index);
      });

      // Down button
      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.style.marginRight = "4px";
      downButton.disabled = (index === selectedLvas.length - 1);
      // If this item is at the bottom, can't move down
      downButton.addEventListener("click", () => {
        moveItemDown(index);
      });

      // Delete button
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        removeItem(index);
      });

      // Append everything
      li.appendChild(labelSpan);
      li.appendChild(upButton);
      li.appendChild(downButton);
      li.appendChild(deleteButton);
      selectedListElement.appendChild(li);
    });
  }

  /**
   * Move the item at `index` one position up in the 'selectedLvas' array
   */
  function moveItemUp(index) {
    if (index > 0) {
      const temp = selectedLvas[index];
      selectedLvas[index] = selectedLvas[index - 1];
      selectedLvas[index - 1] = temp;
      storeSelectedList();
    }
  }

  /**
   * Move the item at `index` one position down
   */
  function moveItemDown(index) {
    if (index < selectedLvas.length - 1) {
      const temp = selectedLvas[index];
      selectedLvas[index] = selectedLvas[index + 1];
      selectedLvas[index + 1] = temp;
      storeSelectedList();
    }
  }

  /**
   * Remove the item at `index` from 'selectedLvas'
   */
  function removeItem(index) {
    selectedLvas.splice(index, 1);
    storeSelectedList();
  }

  /**
   * "Add" button: pick the LVA in the dropdown, append it to selectedLvas, store, and refresh
   */
  addButton.addEventListener("click", () => {
    const selectedValue = lvaDropdown.value;
    if (!selectedValue) return;

    if (!selectedLvas.includes(selectedValue)) {
      selectedLvas.push(selectedValue);
      storeSelectedList();
    }
  });

  /**
   * Initial load when the popup opens
   */
  loadDataAndRender();

  /**
   * Listen for any storage changes so we can refresh automatically 
   * (e.g., if the content script merges new LVAs after the popup is open).
   */
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.courses || changes.selectedList) {
        console.log("Storage changed:", changes);
        loadDataAndRender();
      }
    }
  });
});


document.addEventListener("DOMContentLoaded", () => {
  const resetBtn = document.getElementById("resetStorageBtn");

  resetBtn.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      console.log("All local storage cleared.");
      // Optionally, refresh UI to show empty state
    });
  });
});
