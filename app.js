chrome.runtime.onInstalled.addListener(function () {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              hostEquals: "lpis.wu.ac.at",
            },
          }),
          /* only for development
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostEquals: 'extensions'
          }
        })
        */
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });

});