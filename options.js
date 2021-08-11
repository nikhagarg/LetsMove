'use strict';

chrome.storage.local.get('blockedSites', function(sites) {
    var items = [];
    if(sites.blockedSites) {
        items = sites.blockedSites;
    }
    if(items && items.length > 0) {
        var body = document.getElementsByClassName("blockedBox")[0];

        items.forEach((item, index) => {
            // Create a button of blocked site for UI
            var siteButton = createButton(item);

            //Append to button group
            body.appendChild(siteButton);
        })
    }
});

chrome.storage.local.get('TIME_INTERVAL', function(timeVal) {
    if(timeVal.TIME_INTERVAL) {
        document.getElementById("mySelect").value = timeVal.TIME_INTERVAL;
    }
});

chrome.storage.local.get('WORKING_DAYS', function(days) {
    const WORKING_DAYS = days.WORKING_DAYS;
    if(WORKING_DAYS) {
        if(WORKING_DAYS.day) {
            document.getElementById("WorkingDays").value = WORKING_DAYS.day;
        }
        if(WORKING_DAYS.startTime) {
            document.getElementById("startTime").value = WORKING_DAYS.startTime;
        }
        if(WORKING_DAYS.endTime) {
            document.getElementById("endTime").value = WORKING_DAYS.endTime;
        }
    }
});

document.getElementById("mySelect").onchange = function() {
    var newInterval = document.getElementById("mySelect").value;
    chrome.runtime.sendMessage({msg:'intervalChanged', value: newInterval})
}

document.getElementById("blockSitesForm").onsubmit = function(event) {
    event.preventDefault();
    let boxvalue = document.getElementById('box').value;

    // Create a button of blocked site for UI
    var siteButton = createButton(boxvalue);

    //Append to button group
    var body = document.getElementsByClassName("blockedBox")[0];
    body.appendChild(siteButton);

    // Add site to database
    chrome.runtime.sendMessage({msg:'blockedSiteAdded', value: boxvalue});

    // Reset Input
    document.getElementById('box').value = '';
}

document.getElementById("WorkingDays").onchange = function() {
    var workingDays = document.getElementById("WorkingDays").value;
    chrome.runtime.sendMessage({msg:'workingDaysChanged', value: {type: "DAY", newVal : workingDays}});
}

document.getElementById("startTime").onchange = function() {
    var startTime = document.getElementById("startTime").value;
    chrome.runtime.sendMessage({msg:'workingDaysChanged', value: {type: "START", newVal : startTime}});
}

document.getElementById("endTime").onchange = function() {
    var endTime = document.getElementById("endTime").value;
    chrome.runtime.sendMessage({msg:'workingDaysChanged', value: {type: "END", newVal : endTime}});
}


// document.getElementById("resetBlockedList").onclick = function() {
//     var body = document.getElementsByClassName("blockedBox")[0];
//     body.innerHTML = '';
//     // Update Database
//     chrome.runtime.sendMessage({msg:'resetBlockedList'});
// }

// Working days


function createButton(siteName) {
    var button = document.createElement("button");
    button.innerHTML =  siteName + "  " + "  " +  '<i class="fa fa-times" aria-hidden="true"></i>';
    button.classList.add("blocklistButton");

    // Adding onclick event listener to button
    button.onclick = function() {
        // Remove button from DOM
        var body = document.getElementsByClassName("blockedBox")[0];
        body.removeChild(button);

        // Remove site from database
        chrome.runtime.sendMessage({msg:'blockedSiteDeleted', value: siteName});
    }
    return button;
}

