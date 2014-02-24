// 
// Scheduler for Remember The Milk tasks
//
//     A quick hack by Dale Lane 
//             email@dalelane.co.uk
//             http://dalelane.co.uk/
//             @dalelane
// 
//         4-Jan-2014
//
//     Uses:
//        FullCalendar           : http://arshaw.com/fullcalendar/ 
//        rtm-js                 : https://github.com/michaelday/rtm-js 
//        jQuery UI Touch Punch  : http://touchpunch.furf.com/
//

//
// Polyfill for old browsers 
//  source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
//
if ( !Date.prototype.toISOString ) {
  ( function() {
    
    function pad(number) {
      if ( number < 10 ) {
        return '0' + number;
      }
      return number;
    }
 
    Date.prototype.toISOString = function() {
      return this.getUTCFullYear() +
        '-' + pad( this.getUTCMonth() + 1 ) +
        '-' + pad( this.getUTCDate() ) +
        'T' + pad( this.getUTCHours() ) +
        ':' + pad( this.getUTCMinutes() ) +
        ':' + pad( this.getUTCSeconds() ) +
        '.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice( 2, 5 ) +
        'Z';
    };
  
  }() );
}


//
// Populate the list of currently unscheduled tasks on the left of the page
//
function fetchUnscheduledRtmTasks() {
  $('#unscheduledtasks div.unplannedtask').each(function() {
    $(this).remove();
  });

  $('#rtmloading').show();
  $('#rtmerror').hide();
  rtm.get('rtm.tasks.getList', { filter : 'status:incomplete due:never ' + $('#rtmquerytext').val() }, function(resp){
    $('#rtmloading').hide();
    if (resp.rsp.stat === "ok"){
      $.each(resp.rsp.tasks.list, function(listindex, listitem){
        if (listitem.taskseries){
          if (listitem.taskseries.length){
            $.each(listitem.taskseries, function(taskindex, taskitem){
              handleTaskData(listitem.id, taskitem, false);
            });
          }
          else {
            handleTaskData(listitem.id, listitem.taskseries, false);
          }
        }
      });
    }
    else {
      $('#rtmerror').show().html("RTM API error");
    }
  });
}

//
// Populate the calendar with already scheduled tasks
//
function fetchScheduledRtmTasks() {
  rtm.get('rtm.tasks.getList', { filter : 'status:incomplete' }, function(resp){
    if (resp.rsp.stat === "ok"){
      $.each(resp.rsp.tasks.list, function(listindex, listitem){
        if (listitem.taskseries){
          if (listitem.taskseries.length){
            $.each(listitem.taskseries, function(taskindex, taskitem){
              handleTaskData(listitem.id, taskitem, true);
            });
          }
          else {
            handleTaskData(listitem.id, listitem.taskseries, true);
          }
        }
      });
    }
    else {
      $('#rtmerror').show().html("RTM API error");
    }
  });     
}

//
// Submit a request to reschedule an RTM task
//
function rescheduleTask (listid, taskseriesid, taskid, due, allDay, revertFunc){
  rtm.get('rtm.tasks.setDueDate', { 
    timeline      : window.rtmtimeline, 
    list_id       : listid, 
    taskseries_id : taskseriesid, 
    task_id       : taskid, 
    due           : due ? due.toISOString() : '',
    has_due_time  : !(allDay)
  }, 
  function(resp){
    if ((resp.rsp.stat !== "ok") && revertFunc) {
      revertFunc();
    }
  });
}

// 
// Submit a request to complete an RTM task
//
function completeTask (task, taskui, taskuitype){
  editAndRemoveTask(task, taskui, taskuitype, 'rtm.tasks.complete');
}

// 
// Submit a request to delete an RTM task
//
function deleteTask (task, taskui, taskuitype){
  editAndRemoveTask(task, taskui, taskuitype, 'rtm.tasks.delete');
}

//
// Submit an API request to change a task state and remove it 
//  from the UI (because it has been marked complete, or deleted)
// 
function editAndRemoveTask(task, taskui, taskuitype, apioperation) {
  rtm.get(apioperation, {
    timeline      : window.rtmtimeline, 
    list_id       : task.rtmlistid, 
    taskseries_id : task.rtmtaskseriesid, 
    task_id       : task.rtmtaskid
  },
  function(resp){
    if (resp.rsp.stat === "ok"){
      if (taskuitype === "unscheduled"){
        // remove the task from the unscheduled list
        $(taskui).draggable('destroy');
        $(taskui).remove();
      }
      else if (taskuitype === "scheduled") {
        // remove the task from the calendar
        $('#rtmcalendar').fullCalendar('removeEvents', function(filterEvent){
          return task.rtmlistid === filterEvent.rtmlistid && 
                 task.rtmtaskseriesid === filterEvent.rtmtaskseriesid && 
                 task.rtmtaskid === filterEvent.rtmtaskid;
        });
      }

      $("#edittaskdialog")
        .dialog('close')
        .removeData();
    }
    else {
      alert(resp.rsp.err.msg);
    }
  });
}



//
// Create an object to represent a scheduled RTM task and add to the calendar
// 
function createScheduledTask(listid, taskitem, instance){
  var eventObject = {
    title           : taskitem.name, 
    start           : instance.due, 
    allDay          : instance.has_due_time === "0",
    rtmtaskseriesid : taskitem.id,
    rtmtaskid       : instance.id,
    rtmlistid       : listid,
    rtmtags         : taskitem.tags,
    rtmtaskurl      : taskitem.url,
    rtmtaskpriority : instance.priority 
  };
  $('#rtmcalendar').fullCalendar('renderEvent', eventObject, true);
}

//
// Create an object to represent an unscheduled task and add it to the list next to the calendar
//
function createUnscheduledTask(listid, taskitem, instance){
  var rtmListItemObj = $("<div>", { 
    class: "unplannedtask",
    text : taskitem.name, 
    data : { eventObject : { 
          title           : taskitem.name, 
          rtmtaskid       : taskitem.task.id,
          rtmtaskseriesid : taskitem.id,
          rtmlistid       : listid,
          rtmtags         : taskitem.tags,
          rtmtaskurl      : taskitem.url,
          rtmtaskpriority : instance.priority  } }
  }).draggable({
    start:  function() { $(this).toggle(); }, 
    stop: function() { $(this).toggle(); }, 
    appendTo: "body",
    helper: "clone", 
    scroll: false, 
    zIndex: 999,
    revert: true,      // will cause the event to go back to its
    revertDuration: 0  //  original position after the drag
  }).click(function() {
    var listDiv = $(this);
    displayEditTask({ 
      calData: $(this).data().eventObject,
      uiElement: listDiv,
      uiType: "unscheduled"
    });
  });

  $('#unscheduledtasks').append(rtmListItemObj);
}

// A timeline ID is needed in order to send reschedule requests
function createRtmTimeline(){
  rtm.get('rtm.timelines.create', function(resp){
    if (resp.rsp.stat === "ok"){
      window.rtmtimeline = resp.rsp.timeline;

      $('#newtaskdialoglink').show();
    }
    else {
      $('#rtmerror').show().html("RTM API error");
    }
  });
}

// gets the known lists, for use in autocomplete
function getRtmLists(){
  rtm.get('rtm.lists.getList', function(resp){
    if (resp.rsp.stat === "ok"){
      window.rtmlists = [];
      var editListOptions = "";
      $.each(resp.rsp.lists.list, function(listindex, list){
        if (list.archived === "0" && 
            list.deleted  === "0" && 
            list.smart    === "0")
        {
          window.rtmlists.push(list.name);

          editListOptions += "<option value='" + list.id + "'>" + list.name + "</option>";
        }        
      });
      $("#edittasklist").append(editListOptions);
    }
    else {
      $('#rtmerror').show().html("RTM API error");
    }
  });
}



// Create a new RTM task
function createTask(val){
  rtm.get('rtm.tasks.add', { 
    timeline : window.rtmtimeline, 
    name     : val, 
    parse    : 1 
  }, 
  function(resp){
    if (resp.rsp.stat === "ok") {
      $("#newtaskdialog").dialog("close");
      $("#newtasktext").val("");
      handleTaskData(resp.rsp.list.id, resp.rsp.list.taskseries, false);
    }
    else {
      alert("RTM API error");
    }
  });    
}

// Submit an API request to change the task description
function editTaskTitle(newtitle, data){
  var deferred = $.Deferred();

  if (data.calData.title !== newtitle){
    rtm.get('rtm.tasks.setName', {
        timeline      : window.rtmtimeline, 
        list_id       : data.calData.rtmlistid, 
        taskseries_id : data.calData.rtmtaskseriesid, 
        task_id       : data.calData.rtmtaskid,
        name          : newtitle
      },
      function(resp){
        if (resp.rsp.stat === "ok"){
          data.calData.title = newtitle;
          if (data.uiType === "scheduled"){
            $('#rtmcalendar').fullCalendar('updateEvent', data.calData);
          }
          else if (data.uiType === "unscheduled"){
            data.uiElement[0].innerHTML = newtitle;
            $(data.uiElement[0]).data("eventObject", data.calData);
          }

          deferred.resolve();
        }
        else {
          alert("RTM API error");

          deferred.reject();
        }
      }
    );
  }
  else {
    deferred.resolve();
  }
  return deferred.promise();
}

// Submit an API request to change an attribute of the task
function editTaskMetadata(datatype, newvalue, data){
  var deferred = $.Deferred();
  
  if ((datatype === "priority" && data.calData.rtmtaskpriority === newvalue) ||
      (datatype === "url" && data.calData.rtmtaskurl === newvalue) ||
      (datatype === "tags" && flattenTags(data.calData.rtmtags) === newvalue))
  {
    deferred.resolve();
  }
  else {
    var apiname = "";

    var apipayload = {
        timeline      : window.rtmtimeline, 
        list_id       : data.calData.rtmlistid, 
        taskseries_id : data.calData.rtmtaskseriesid, 
        task_id       : data.calData.rtmtaskid
    };
    apipayload[datatype] = newvalue;

    switch (datatype){
      case "priority":
        data.calData.rtmtaskpriority = newvalue;
        apiname = "rtm.tasks.setPriority";
        break;
      case "url":
        data.calData.rtmtaskurl = newvalue;
        apiname = "rtm.tasks.setURL";
        break;
      case "tags":
        data.calData.rtmtags = newvalue;
        apiname = "rtm.tasks.setTags";
        break;
    }

    rtm.get(apiname, apipayload, 
      function(resp){
        if (resp.rsp.stat === "ok"){
          if (data.uiType === "scheduled"){
            $('#rtmcalendar').fullCalendar('updateEvent', data.calData);
          }
          else if (data.uiType === "unscheduled"){
            $(data.uiElement[0]).data("eventObject", data.calData);
          }

          deferred.resolve(); 
        }
        else {
          alert("RTM API error");

          deferred.reject();
        }
      }
    );  
  }

  return deferred.promise();
}

// Submit an API request to move a task from one list to another
function editTaskList(newlistid, data){
  var deferred = $.Deferred();
  
  if (data.calData.rtmlistid !== newlistid){
    var apipayload = {
        timeline      : window.rtmtimeline, 
        taskseries_id : data.calData.rtmtaskseriesid, 
        task_id       : data.calData.rtmtaskid,      
        from_list_id  : data.calData.rtmlistid, 
        to_list_id    : newlistid
    };

    rtm.get("rtm.tasks.moveTo", apipayload, 
      function(resp){
        if (resp.rsp.stat === "ok"){
          data.calData.rtmlistid = newlistid;
          if (data.uiType === "scheduled"){
            $('#rtmcalendar').fullCalendar('updateEvent', data.calData);
          }
          else if (data.uiType === "unscheduled"){
            $(data.uiElement[0]).data("eventObject", data.calData);
          }

          deferred.resolve();
        }
        else {
          alert("RTM API error");

          deferred.reject();
        }
      }
    );  
  }
  else {
    deferred.resolve();
  }

  return deferred.promise();
}


//
// Utility functions to handle variable response formats
//
function handleTaskData(listid, taskinfo, ignoreunscheduled){
  if (taskinfo.task.length){
    $.each(taskinfo.task, function(taskinstanceindex, taskinstance){
      handleTask(listid, taskinfo, taskinstance, ignoreunscheduled);
    });
  }
  else {
    handleTask(listid, taskinfo, taskinfo.task, ignoreunscheduled);
  }
}
function handleTask(listid, taskitem, instance, ignoreunscheduled){
  if (instance.due){
    createScheduledTask(listid, taskitem, instance);
  }
  else if (!(ignoreunscheduled)){
    createUnscheduledTask(listid, taskitem, instance);
  }

  if (taskitem.tags.tag){
    if ($.isArray(taskitem.tags.tag) && taskitem.tags.tag.length > 0){
      $.each(taskitem.tags.tag, function(tagidx, tag){
        if (window.rtmtags.indexOf(tag) === -1){
          window.rtmtags.push(tag);
        }
      });
    }  
    else {
      if (window.rtmtags.indexOf(taskitem.tags.tag) === -1){
          window.rtmtags.push(taskitem.tags.tag);
      }
    }
  }  
}


//
// displays and populates the dialog for editing RTM tasks
// 
function displayEditTask(dlgData){
  $("#edittaskdialog").dialog({ width : 490, height: 260, title: dlgData.calData.title }).data(dlgData);
  $("#edittasktext").val(dlgData.calData.title);
  $("#edittasklist").val(dlgData.calData.rtmlistid);
  $("#edittaskurl").val(dlgData.calData.rtmtaskurl);
  $("#edittaskpriority").val(dlgData.calData.rtmtaskpriority);
  $("#edittasktags").val(flattenTags(dlgData.calData.rtmtags));
}

// RTM API returns tags in different forms based on whether there is none, one or several
//   Handle all of these here, returning them in a single consistent form
function flattenTags(tagsObject){
  if (!(tagsObject) || !(tagsObject.tag)){
    return "";
  }
  if ($.isArray(tagsObject.tag) && tagsObject.tag.length > 0){
    return tagsObject.tag.join(", ");
  }  
  return tagsObject.tag;
}

//
// Remember The Milk Auth API functions
//
$(document).ready(function() {
  var api_key = 'b418693f6976a9f54e5ee466102b9358',
      api_secret = '0b8666a5529c6076',
      checkPopup,
      popup,
      token,
      frob,
      permissions = 'delete';

  window.rtmtags = [];
  window.rtm = new RememberTheMilk(api_key, api_secret, permissions);

  frob = getCookie("rtmfrob");
  var rtmAuthToken;

  if (frob){
    $('#rtmauth').attr('disabled', null);

    rtmAuthToken = getCookie("rtmauthtoken");
  }
  else {
    rtm.get('rtm.auth.getFrob', function(resp){
      $('#rtmauth').attr('disabled', null);
      frob = resp.rsp.frob;
      setCookie("rtmfrob", frob);
    });
  }

  if (rtmAuthToken){
    rtm.auth_token = rtmAuthToken;

    $('#rtmauth').hide();
    $('#rtmquery').show();

    fetchUnscheduledRtmTasks();
    fetchScheduledRtmTasks();
    createRtmTimeline();
    getRtmLists();
  }
  else {
    $('#rtmauth').click(function(){
      var authUrl = rtm.getAuthUrl(frob);
      popup = window.open(authUrl);

      checkPopup = setInterval(function(){
        if (popup.closed == true) {
          clearInterval(checkPopup);

          rtm.get('rtm.auth.getToken', {frob: frob}, function(resp){
            rtm.auth_token = resp.rsp.auth.token;

            setCookie("rtmauthtoken", rtm.auth_token);

            $('#rtmauth').hide();
            $('#rtmquery').show();

            fetchUnscheduledRtmTasks();
            fetchScheduledRtmTasks();
            createRtmTimeline();
            getRtmLists();
          });
        }
      }, 200);
    });
  }

  $( "#newtaskbtn" ).button().click(function(event){
    createTask($("#newtasktext").val());
  });

  $('#completetaskbtn').button().click(function(event){
    var data = $("#edittaskdialog").data();
    completeTask(data.calData, data.uiElement, data.uiType);
  });
  $('#deletetaskbtn').button().click(function(event){
    var data = $("#edittaskdialog").data();
    deleteTask(data.calData, data.uiElement, data.uiType);
  });
  $('#edittaskbtn').button().click(function(event){
    $('#edittaskbtn').button("disable");

    var data = $("#edittaskdialog").data();


    // submit API requests for any fields which have changed
    //  chaining the requests rather than submitting them all
    //  at once to avoid hitting RTM rate limits

    var newtitle = $("#edittasktext").val();
    var newpriority = $('#edittaskpriority').val();
    var newurl = $('#edittaskurl').val();
    var newtags = $('#edittasktags').val();
    var newlist = $('#edittasklist').val();

    editTaskList(newlist, data)
      .pipe(function() { return editTaskTitle(newtitle, data); })
      .pipe(function() { return editTaskMetadata("priority", newpriority, data); })
      .pipe(function() { return editTaskMetadata("url",      newurl,      data); })
      .pipe(function() { return editTaskMetadata("tags",     newtags,     data); })
      .done(function() 
      {
        $('#edittaskbtn').button("enable");

        $("#edittaskdialog")
          .dialog('close')
          .removeData();
      });
  });



//
// Calendar API functions
//

  var _taskBeingDragged = null;

  $("#unscheduledtasks").droppable({
    drop: function( event, ui ) {
      // handle a task being dragged from the calendar to the unscheduled list
      if (_taskBeingDragged){
        // submit the update to RTM
        rescheduleTask(_taskBeingDragged.event.rtmlistid, _taskBeingDragged.event.rtmtaskseriesid, _taskBeingDragged.event.rtmtaskid);

        // remove the task from the calendar
        $('#rtmcalendar').fullCalendar('removeEvents', function(filterEvent){
          return _taskBeingDragged.event.rtmlistid === filterEvent.rtmlistid && 
                 _taskBeingDragged.event.rtmtaskseriesid === filterEvent.rtmtaskseriesid && 
                 _taskBeingDragged.event.rtmtaskid === filterEvent.rtmtaskid;
        });

        // add the task to the unscheduled list
        createUnscheduledTask(_taskBeingDragged.event.rtmlistid, {
            id   : _taskBeingDragged.event.rtmtaskseriesid,
            name : _taskBeingDragged.event.title,
            task : { id : _taskBeingDragged.event.rtmtaskid },
            tags : _taskBeingDragged.event.rtmtags,
            url  : _taskBeingDragged.event.rtmtaskurl
        }, { priority : _taskBeingDragged.event.rtmtaskpriority });
      }
    }
  });

  var calendarParameters = {
    header: {
      left: 'prev,next today',
      center: 'title',
      right: 'month,agendaWeek,basicWeek,agendaDay,basicDay'
    },
    firstDay: 1, 
    editable: true,    
    droppable: true, 
    drop: function(date, allDay) { 
      // handle a task being dragged from the unscheduled list to the calendar
      var originalEventObject = $(this).data('eventObject');
      
      var copiedEventObject = $.extend({}, originalEventObject);
      copiedEventObject.start = date;
      copiedEventObject.allDay = allDay;
      
      $('#rtmcalendar').fullCalendar('renderEvent', copiedEventObject, true);
      
      $(this).remove();

      rescheduleTask(copiedEventObject.rtmlistid, copiedEventObject.rtmtaskseriesid, copiedEventObject.rtmtaskid, date, allDay);
    },
    eventDrop: function(event, dayDelta, minuteDelta, allDay, revertFunc) {
      // handle a task being dragged from one part of the calendar to another
      rescheduleTask(event.rtmlistid, event.rtmtaskseriesid, event.rtmtaskid, event.start, allDay, revertFunc);
    },
    eventDragStart: function( event, jsEvent, ui, view ) {
      _taskBeingDragged = { event : event, jsEvent : jsEvent };
    },
    viewRender: function( view, element ) {
      setCookie("calview", $("#rtmcalendar").fullCalendar("getView").name);
    },
    eventClick: function(calEvent, jsEvent, view) {
      if (calEvent.rtmtaskid){
        displayEditTask({ 
          calData : calEvent,
          uiElement: this,
          uiType: "scheduled"         
        });
      }
    }
  };
  var gcalxml = getCookie("gcalxml");
  if (gcalxml){
    calendarParameters.events = { url : gcalxml, className : 'gcal-event' };
    $("#googlecalsettings").show();
    $("#googlecalendartogglebtn").prop("checked", true);    
  }
  var view = getCookie("calview");
  if (view){
    calendarParameters.defaultView = view;
  }

  $('#rtmcalendar').fullCalendar(calendarParameters);

  $('.fc-button-basicDay')[0].innerHTML = "day list";
  $('.fc-button-basicWeek')[0].innerHTML = "week list";


  //
  // Google Calendar support
  // 

  $( "#googlecalendarbutton" ).button().click(function(event){
    // remove any existing Google Calendar entries
    $('#rtmcalendar').fullCalendar("removeEvents", function(eventObj){
        return eventObj.source.dataType === "gcal";
    });

    // store the Google Calendar URL in a cookie
    var gcalxml = $("#googlecalendarxml").val();
    setCookie("gcalxml", gcalxml);

    // add the Google Calendar source to the calendar
    if (gcalxml){
      $('#rtmcalendar').fullCalendar("addEventSource", { url : gcalxml, className : 'gcal-event' });
      $("#googlecalsettings").show();
      $("#googlecalendartogglebtn").prop("checked", true);
    }
    else {
      $("#googlecalsettings").hide();
    }

    // close the dialog
    $("#googlecalendardialog").dialog("close");
  });
  $("#googlecalendartogglebtn").change(function(eventObj){
    if ($("#googlecalendartogglebtn").prop("checked")){
      $('#rtmcalendar').fullCalendar("addEventSource", { url : getCookie("gcalxml"), className : 'gcal-event' });
    }
    else {
      $('#rtmcalendar').fullCalendar("removeEvents", function(eventObj){
        return eventObj.source.dataType === "gcal";
      });
    }
  });


  // 
  // Display dialogs
  //
  $("a#rtmschedabout").click(function(e) {
      e.preventDefault();
      $("#aboutdialog").dialog({ width : 700 });
  });
  $("a#googlecalendar").click(function(e) {
      e.preventDefault();
      $("#googlecalendarxml").val(getCookie("gcalxml"));
      $("#googlecalendardialog").dialog({ width : 700 });
  });
  $("a#newtaskdialoglink").click(function(e) {
      e.preventDefault();
      $("#newtaskdialog").dialog({ width : 400 });
      $("#newtasktext").focus();
  });


  // 
  // autocomplete text boxes
  //
  addAutocomplete("#newtasktext", "#", true);
  addAutocomplete("#rtmquerytext", "list:", false);

  // 
  // Clear RTM credentials
  //
  $("a#rtmlogout").click(function(e) {
      e.preventDefault();
      deleteCookie("rtmfrob");
      deleteCookie("rtmauthtoken");
      deleteCookie("gcalxml");
      window.location = window.location.pathname;
  });

  // Handle search queries from the user by refreshing the list of unscheduled tasks
  $('#rtmquery').submit(function(event) {
    event.preventDefault();
    fetchUnscheduledRtmTasks();
    return false;
  });

});

function addAutocomplete(textboxselector, listprefix, includetags){
  $(textboxselector)
    // don't navigate away from the field on tab when selecting an item
    .bind( "keydown", function( event ) {
      if ( event.keyCode === $.ui.keyCode.TAB &&
        $( this ).data( "ui-autocomplete" ).menu.active ) {
          event.preventDefault();
        }
    })
    .autocomplete({
      minLength : 0,
      source    : function(req, resp){
        var caretPos = $(textboxselector)[0].selectionStart;
        var prevSpace = getCurrentTerm(req.term, caretPos, listprefix);
        if (prevSpace >= 0){
          var currentTerm = req.term.substring(prevSpace, caretPos);
          resp($.ui.autocomplete.filter(includetags ? window.rtmlists.concat(window.rtmtags) : window.rtmlists, 
                                        currentTerm));
        }
      },
      focus     : function() { return false; },
      select    : function(event, ui){
        var caretPos = event.target.selectionStart;
        var prevSpace = getCurrentTerm(event.target.value, caretPos, listprefix);
        if (prevSpace >= 0){
          var selectedValue = ui.item.value;
          if (selectedValue.indexOf(" ") !== -1){
            selectedValue = '"' + selectedValue + '"';
          }
          this.value = event.target.value.substring(0, prevSpace) + 
                       selectedValue + 
                       event.target.value.substring(caretPos);
          event.target.selectionStart = prevSpace + selectedValue.length;
          event.target.selectionEnd = prevSpace + selectedValue.length;
        }
        return false;
      }
    });
}

// Used for auto-complete text boxes, to identify the word that is 
//   currently being edited in the text box (allowing for the fact
//   that users can edit text from somewhere inside the text, not 
//   necessarily at the end)
function getCurrentTerm(completeString, caretPos, prefix){
  var idx = completeString.indexOf(prefix);
  var lastSpace = idx;
  while (idx >= 0){
    idx = completeString.indexOf(" " + prefix, idx + 1);
    if (idx > -1 && idx < caretPos){
      lastSpace = idx;
    }
  }
  if (lastSpace >= 0){
    return lastSpace + prefix.length;
  } 
  else {
    return lastSpace;
  }
}


// 
// Cookie methods
//

function setCookie(name, value) {
  var d = new Date();
  d.setTime(d.getTime()+(30*24*60*60*1000));
  var expires = "expires="+d.toGMTString();
  document.cookie = name + "=" + value + "; " + expires;
}

function getCookie(cookievalname) {
  var name = cookievalname + "=";
  var ca = document.cookie.split(';');
  for(var i=0; i<ca.length; i++){
    var c = ca[i].trim();
    if (c.indexOf(name)==0){
      return c.substring(name.length,c.length);
    }
  }
  return "";
}

function deleteCookie(name) {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  var expires = "expires="+d.toGMTString();
  document.cookie = name + "=deleted" + "; " + expires;
}
