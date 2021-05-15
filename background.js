(function(){

var DEFAULT_UPDATE_INTERVAL = 1000;

var TIME_INTERVAL_IN_MIN = 45;
var TIME_LIMIT_IN_SEC_YELLOW = TIME_INTERVAL_IN_MIN*60;
var TIME_LIMIT_IN_SEC_RED = 2*TIME_INTERVAL_IN_MIN*60;
var CODE = "GREEN";
var RESET_TIME = 0;
var NOTIFICATION_CLEAR_TIME_IN_MS = 10000;
var NOTIF_SNOOZE_TIME_IN_MIN = 10; 
var SNOOZE_TIME = -1;
var BLOCKED_SITES = [];

onInit();

function onInit() {
    setInterval(runBG, DEFAULT_UPDATE_INTERVAL);
}

chrome.storage.local.get('blockedSites', function(sites) {
    if(sites.blockedSites) {
        BLOCKED_SITES = sites.blockedSites;
    }
})

chrome.storage.local.get('TIME_INTERVAL', function(tiveVal) {
    if(tiveVal.TIME_INTERVAL) {
        TIME_INTERVAL_IN_MIN = tiveVal.TIME_INTERVAL;
        updateIntervals();
    }
})

function updateIntervals() {
    TIME_LIMIT_IN_SEC_YELLOW = TIME_INTERVAL_IN_MIN*60;
    TIME_LIMIT_IN_SEC_RED = 2*TIME_INTERVAL_IN_MIN*60;
}

function runBG() {
    chrome.windows.getLastFocused({ populate: true }, function(currentWindow) {
        if(currentWindow.focused) {
            let activeTab = currentWindow.tabs.find(t => t.active === true);
            chrome.storage.local.set({'activeTab' : activeTab.url});
            if(activeTab !== undefined) {
                console.log("active tab is : " + activeTab.url );
                let hostname = extractHostname(activeTab.url);
                if(!isBlackListed(hostname)) {
                    updateTimer();
                } else {
                    console.log("freeze timer");
                }
                // chrome.idle.queryState(parseInt('120'), function(state) {
                //     if(state === 'idle' || state === 'locked') {
                //         resetTimer();
                //     } else {
                //         updateTimer();
                //     }
                // })
            }
        } else updateTimer();
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.msg == "activityCompleted") {
        resetTimer();
    } else if(request.msg == "blockedSiteAdded") {
        let newSite = request.value;
        if(newSite) {
            let new_hostname = extractHostname(newSite);
            if(!isBlackListed(new_hostname)) {
                // AVOIDING DUPLICACY: if site already exists in blocked list, do not add it again.
                BLOCKED_SITES.push(extractHostname(newSite));
                chrome.storage.local.set({'blockedSites' : BLOCKED_SITES});
            }
        }
    } else if(request.msg == "blockedSiteDeleted") {
        let siteToDelete = request.value;
        if(siteToDelete) {
            let hostname = extractHostname(siteToDelete);
            if(isBlackListed(hostname)) {
                var index = BLOCKED_SITES.indexOf(extractHostname(hostname));
                if(index != -1) {
                    BLOCKED_SITES.splice(index,1);
                    chrome.storage.local.set({'blockedSites' : BLOCKED_SITES});
                }
            }
        }
    } else if(request.msg == "resetBlockedList") {
        BLOCKED_SITES = [];
        chrome.storage.local.set({'blockedSites' : BLOCKED_SITES});
    } else if(request.msg == "intervalChanged") {
        TIME_INTERVAL_IN_MIN = request.value;
        chrome.storage.local.set({'TIME_INTERVAL' : TIME_INTERVAL_IN_MIN});
        updateIntervals();
    }
})

function resetTimer() {
    console.log(" timer is reset");
    chrome.browserAction.setIcon({path: "img/Active.png"});
    changeBadgeColor("green");
    CODE = "GREEN";
    chrome.storage.local.set({'timer' : parseInt(RESET_TIME)});
    chrome.browserAction.setBadgeText({text : ''});
}

function updateTimer() {
    console.log('timer is updated');
    chrome.storage.local.get('timer', function(timerVal) {
        if(isLimitExceeded(timerVal.timer)) {
            if(timerVal.timer < TIME_LIMIT_IN_SEC_YELLOW && CODE !== "GREEN") {
                chrome.browserAction.setIcon({path: "img/Active.png"});
                changeBadgeColor("green");
                CODE = "GREEN";
            } else if(timerVal.timer >= TIME_LIMIT_IN_SEC_YELLOW && timerVal.timer < TIME_LIMIT_IN_SEC_RED && CODE !== "YELLOW") {
                chrome.browserAction.setIcon({path: "img/Inactive_1.png"});
                changeBadgeColor("yellow");
                CODE = "YELLOW";
            } else if(timerVal.timer >= TIME_LIMIT_IN_SEC_RED && CODE !== "RED") {
                chrome.browserAction.setIcon({path: "img/Inactive_2.png"});
                changeBadgeColor("red");
                CODE = "RED";
                notifyMe();
            } 
            // window.open("popup.html", "extension_popup", "width=300,height=400,status=no,scrollbars=yes,resizable=no");
            // chrome.tabs.create({url: "popup.html"});
        }

        // IF NOTIFICATIONS WERE SNOOZED BY THE USER
        if(SNOOZE_TIME === timerVal.timer) {
                SNOOZE_TIME = -1;
                notifyMe();
        }

        var newtime = 1;
        if(timerVal.timer) {
            newtime += parseInt(timerVal.timer);
        }
        chrome.storage.local.set({'timer' : newtime});
        chrome.browserAction.setBadgeText({text : changeTimeFormat(newtime)});
    })
}

// function isValidUrl(tab) {
//     if(!tab 
//         || !tab.url 
//         || (tab.url.indexOf('http:') == -1 && tab.url.indexOf('https:') == -1) 
//         || tab.url.indexOf('chrome://') !== -1
//         || tab.url.indexOf('chrome://extensions') !== -1) 
//         return false;
//     return true;
// }

function extractHostname(url) {
    var hostname;
    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }
    hostname = hostname.split(':')[0];
    hostname = hostname.split('?')[0];

    if(hostname.indexOf('www.') > -1) {
        hostname = hostname.split('www.')[1];
    }
    return hostname;
}

function isDomainEqual(first, second) {
    return first === second;
}

function isBlackListed(domain) {
    if(BLOCKED_SITES != undefined && BLOCKED_SITES.length > 0) {
        return BLOCKED_SITES.find(site => isDomainEqual(extractHostname(site), extractHostname(domain))) != undefined;
    } else return false;
}

function isLimitExceeded(timeVal) {
    if(timeVal !== undefined && timeVal >= parseInt(TIME_LIMIT_IN_SEC_YELLOW)) return true;
    return false;
}

function changeTimeFormat(time) {
    var hr = parseInt(time/3600);
    var min = parseInt((time - hr*3600)/60);
    var sec = parseInt(time - hr*3600 - min*60); 

    var display_time = '';
    if(hr !== 0){
        display_time = hr.toString() + 'h';
    } else if(min !== 0){
        display_time =  min.toString() + 'm';
    } else{
        display_time = sec.toString() + 's';
    }
    return display_time;
}

function changeBadgeColor(colorName) {
    chrome.browserAction.setBadgeBackgroundColor({color : colorName});
}

function notifyMe() {
    chrome.notifications.create("", {
        title : "Testing...",
        message : " How about taking a break from work for a nice stretch?",
        iconUrl : 'img/Active.png',
        type : 'basic',
        requireInteraction : true,
        buttons : [{
            title: 'snooze'
        }]
    }, function(notificationId) {
        setTimeout(function() {
            chrome.notifications.clear(notificationId, function(){});
        }, NOTIFICATION_CLEAR_TIME_IN_MS);
    });
}

function notificationsSnoozed() {
    var snooze = NOTIF_SNOOZE_TIME_IN_MIN*60;
    chrome.storage.local.get('timer', function(timerVal) {
        SNOOZE_TIME = timerVal.timer + snooze;
    });
}

chrome.notifications.onClicked.addListener(function(notificationId, byUser) {
    window.open("popup.html", "extension_popup", "width=300,height=400,status=no,scrollbars=yes,resizable=yes");
    chrome.notifications.clear(notificationId, function(){});
});

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    if(buttonIndex === 0) {
        notificationsSnoozed();
    }
    chrome.notifications.clear(notificationId, function(){});
})

chrome.contextMenus.create({
    id: "resetTimer",
    title : "Reset timer",
    contexts : ["browser_action"]
});

chrome.contextMenus.onClicked.addListener(function(clicked) {
    if(clicked.menuItemId == "resetTimer") {
        resetTimer();
    }
})

})();

