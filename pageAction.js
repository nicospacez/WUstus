var courses = document.getElementsByClassName("ver_id");
var enabler = false;

courseNums = [];
for (var i = 0; i <= courses.length - 1; i++) {
    courseNums.push(courses[i].getElementsByTagName("a")[0].innerHTML)
}

let keyC = 'courseNums' + window.location.href;
chrome.storage.sync.set({
    [keyC]: courseNums
}, function () {
    console.log('Options set to ' + courseNums);
});

chrome.storage.sync.get({
    enabler: []
}, function (result) {
    let key = 'selectedCourse' + window.location.href;
    chrome.storage.sync.get({
        [key]: []
    }, function (result1) {
        console.log("selected course:" + result1[key]);
        if (result.enabler && result1[key] != null) {
            selectAndClick(result1[key]);
        }
    });

});

function selectAndClick(courseNum) {

    let pos = null;
    for (var i = 0; i <= courses.length - 1; i++) {
        if (courses[i].getElementsByTagName("a")[0].innerHTML == courseNum) {
            console.log(i)
            pos = i;
        }
    }

    //console.log(courses[pos].parentElement)
    //console.log(courses[pos].parentElement.childNodes[9].childNodes[1].childNodes[17])
    var bar = courses[pos].parentElement;
    bar.style.backgroundColor = '#2ecc71';

    var myButton = courses[pos].parentElement.childNodes[9].childNodes[1].childNodes[17];
    myButton.style.backgroundColor = '#ff0000';

    if (!myButton.disabled) {
        myButton.click();
    } else {
        window.location.reload();
    }

}