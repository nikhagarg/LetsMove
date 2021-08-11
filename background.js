(function(){

var TIME_INTERVAL_IN_MIN = 45;
var RESET_TIME = 0;
var NOTIFICATION_CLEAR_TIME_IN_MS = 10000;
var NOTIF_SNOOZE_TIME_IN_MIN = 10; 
var BLOCKED_SITES = [];
var WORKING_DAYS = {}; // WORKING_DAYS = {day: "Weekday", startTime: "09:00", endTime : "17:00"}

onInit();

function onInit() {
    setInterval(runBG, 1000);
}

chrome.storage.local.get('blockedSites', function(sites) {
    if(sites.blockedSites) {
        BLOCKED_SITES = sites.blockedSites;
    }
})

chrome.storage.local.get('TIME_INTERVAL', function(tiveVal) {
    if(tiveVal.TIME_INTERVAL) {
        TIME_INTERVAL_IN_MIN = tiveVal.TIME_INTERVAL;
    }
})

chrome.storage.local.get('WORKING_DAYS', function(days) {
    if(days.WORKING_DAYS) {
        WORKING_DAYS = days.WORKING_DAYS;
    } 
    else {
        WORKING_DAYS = {day: "Weekday", startTime: "09:00", endTime : "17:00"};
        chrome.storage.local.set({'WORKING_DAYS' : WORKING_DAYS});
    }
})

function runBG() {
    if(!isTodayWorkingDay()) return;

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
    } 
    else if(request.msg == "intervalChanged") {
        TIME_INTERVAL_IN_MIN = request.value;
        chrome.storage.local.set({'TIME_INTERVAL' : TIME_INTERVAL_IN_MIN});
    } 
    else if(request.msg == "workingDaysChanged") {
        if(request.value.type == "DAY") {
            WORKING_DAYS.day = request.value.newVal;
        } else if(request.value.type == "START") {
            WORKING_DAYS.startTime = request.value.newVal;
        } else if(request.value.type == "END") {
            WORKING_DAYS.endTime = request.value.newVal;
        }
        chrome.storage.local.set({'WORKING_DAYS' : WORKING_DAYS});
    }
})

getCurrentDate = function() {
    return new Date();
}

getCurrentDay = function(currentDate) {
    return currentDate.getDay();
}

getCurrentTime = function(currentDate) {
    function padding(num) {
        num = num.toString();
        if(num.length < 2) num = '0' + num;
        return num;
    }
    return padding(currentDate.getHours()) + ':' + padding(currentDate.getMinutes());
}

function resetTimer() {
    console.log(" timer is reset");
    chrome.storage.local.set({'timer' : parseInt(RESET_TIME)});
}

function updateTimer() {
    console.log('timer is updated');
    chrome.storage.local.get('timer', function(timerVal) {
        const currentDate = getCurrentDate();
        const currentTime = getCurrentTime(currentDate);
        if(WORKING_DAYS.startTime == currentTime) {
            resetTimer();
        }
        if(isLimitExceeded(timerVal.timer)) {
            notifyMe();
        }

        var newtime = 1;
        if(timerVal.timer) {
            newtime += parseInt(timerVal.timer);
        }
        chrome.storage.local.set({'timer' : newtime});
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
    if(timeVal !== undefined && timeVal >= parseInt(TIME_INTERVAL_IN_MIN*60)) return true;
    return false;
}

// function changeTimeFormat(time) {
//     var hr = parseInt(time/3600);
//     var min = parseInt((time - hr*3600)/60);
//     var sec = parseInt(time - hr*3600 - min*60); 

//     var display_time = '';
//     if(hr !== 0){
//         display_time = hr.toString() + 'h';
//     } else if(min !== 0){
//         display_time =  min.toString() + 'm';
//     } else{
//         display_time = sec.toString() + 's';
//     }
//     return display_time;
// }

function isTodayWorkingDay() {
    const currentDate = getCurrentDate();
    const day = getCurrentDay(currentDate);
    let activeDays = [];
    switch (WORKING_DAYS.day) {
        case "Weekday": 
            activeDays = [1,2,3,4,5];
            break;
        case "Weekend": 
            activeDays = [6,0];
            break;
        case "ALL": 
            activeDays = [0,1,2,3,4,5,6];
            break;
        default: 
            break;
    }
    
    const currentTime = getCurrentTime(currentDate);

    if(activeDays.includes(day) && WORKING_DAYS.startTime <= currentTime && WORKING_DAYS.endTime >= currentTime) {
        return true;
    }
    return false;
}

function notifyMe() {
    createNotification();
    audioNotification();

    function createNotification() {
        chrome.notifications.create("", {
            title : "Testing...",
            message : randomMessage(),
            iconUrl : 'img/Active.png',
            type : 'basic',
            requireInteraction : true,
            buttons : [{
                title: 'snooze'
            }]
        }, function(notificationId) {
            resetTimer();
            setTimeout(function() {
                chrome.notifications.clear(notificationId, function(){});
            }, NOTIFICATION_CLEAR_TIME_IN_MS);
        });
    }

    function audioNotification() {
        var myAudio = new Audio();
        myAudio.src = chrome.extension.getURL("/sounds/tink.wav");
        myAudio.play();
    }

    function randomMessage() {
        const msg = [
            "How about taking a break from work for a nice stretch?",
            "Yoohoooooooooooooo",
            "lalalalalallalalal",
            "papapapapapapapapap"
        ]
        var i = Math.floor(Math.random() * msg.length);
        return msg[i];
    }
}

function notificationsSnoozed() {
    var snooze = (TIME_INTERVAL_IN_MIN - NOTIF_SNOOZE_TIME_IN_MIN)*60;
    chrome.storage.local.get('timer', function(timerVal) {
        chrome.storage.local.set({'timer' : parseInt(snooze)});
    });
}

chrome.notifications.onClicked.addListener(function(notificationId, byUser) {
    window.open("popup.html", "extension_popup", "width=300,height=400,status=no,scrollbars=yes,resizable=yes");
    chrome.notifications.clear(notificationId, function(){});
    resetTimer();
});

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    if(buttonIndex === 0) {
        notificationsSnoozed();
    } else {
        resetTimer();
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

