// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

let enabler = document.getElementById('enabler');
let selectOptions = document.getElementById("courseSelect");
let donationClose = document.getElementById("donationClose");

let selectedCourse = null;
var url = null;

fireQuery();


function callback(tabs) {
  url = tabs[0].url;
  console.log(url);
  initSelect();
}

function fireQuery() {

  var query = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(query, callback);
}

function initSelect() {

  let keyC = 'courseNums' + url;
  chrome.storage.sync.get({
    [keyC]: []
  }, function (result) {
    console.log('Value currently is ' + result[keyC]);
    for (var i = 0; i <= result[keyC].length - 1; i++) {
      var option = document.createElement("option");
      option.text = result[keyC][i];
      option.value = result[keyC][i];
      var select = document.getElementById("courseSelect");
      select.appendChild(option);
    }
  });

  let key = 'selectedCourse' + url;

  chrome.storage.sync.get({
    [key]: []
  }, function (result) {
    console.log("init course:" + result[key]);
    selectOptions.value = result[key];
  });

}


selectOptions.onchange = function () {

  selectedCourse = selectOptions.options[selectOptions.selectedIndex].value;

  let key1 = 'selectedCourse' + url;

  chrome.storage.sync.set({
    [key1]: selectedCourse
  }, function () {
    console.log('Value is set to ' + selectedCourse + " on: " + key1);
  });

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
    chrome.tabs.update(tabs[0].id, {
      url: tabs[0].url
    });
  });
}

chrome.storage.sync.get({
  enabler: []
}, function (result) {
  console.log(result);

  if (result.enabler) {
    if (!enabler.checked) {
      enabler.click();
    }
  } else {
    if (enabler.checked) {
      enabler.click();
    }
  }
});

enabler.onclick = function (event) {
  console.log(selectOptions.options[selectOptions.selectedIndex].value);
  var sel = selectOptions.options[selectOptions.selectedIndex].value;
  if (sel == null || sel == undefined || sel == "") {
    if(enabler.checked){
      document.getElementById("selectMsg").style.display = 'block';
      enabler.checked = false;
    }
  }else{
    if (enabler.checked) {
      chrome.storage.sync.set({
        enabler: true
      }, function () {
        console.log('Enabler set true');
      });
    } else {
      chrome.storage.sync.set({
        enabler: false
      }, function () {
        console.log('Enabler set false');
      });
    }
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function (tabs) {
      chrome.tabs.update(tabs[0].id, {
        url: tabs[0].url
      });
    });
  }
};

donationClose.onclick = function(){
  donationClose.parentElement.style.display = 'none';
}