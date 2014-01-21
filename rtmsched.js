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
function completeTask (task, taskui){
  editAndRemoveTask(task, taskui, 'rtm.tasks.complete');
}

// 
// Submit a request to delete an RTM task
//
function deleteTask (task, taskui){
  editAndRemoveTask(task, taskui, 'rtm.tasks.delete');
}

function editAndRemoveTask(task, taskui, apioperation) {
  rtm.get(apioperation, {
    timeline      : window.rtmtimeline, 
    list_id       : task.rtmlistid, 
    taskseries_id : task.rtmtaskseriesid, 
    task_id       : task.rtmtaskid
  },
  function(resp){
    if (resp.rsp.stat === "ok"){
      if (taskui){
        // remove the task from the unscheduled list
        $(taskui).draggable('destroy');
        $(taskui).remove();
      }
      else {
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
    rtmlistid       : listid 
  };
  $('#rtmcalendar').fullCalendar('renderEvent', eventObject, true);
}

//
// Create an object to represent an unscheduled task and add it to the list next to the calendar
//
function createUnscheduledTask(listid, taskitem){
  var rtmListItemObj = $("<div>", { 
    class: "unplannedtask",
    text : taskitem.name, 
    data : { eventObject : { 
          title           : taskitem.name, 
          rtmtaskid       : taskitem.task.id,
          rtmtaskseriesid : taskitem.id,
          rtmlistid       : listid  } }
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
    $("#edittaskdialog").dialog({ 
      width : 400, 
      height: 110, 
      title: taskitem.name 
    }).data({ 
      calData: $(this).data().eventObject,
      uiElement: listDiv
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
      // createUnscheduledTask( resp.rsp.list.id, {
      //   id   : resp.rsp.list.taskseries.id,
      //   name : resp.rsp.list.taskseries.name,
      //   task : { id : resp.rsp.list.taskseries.task.id }
      // });
      handleTaskData(resp.rsp.list.id, resp.rsp.list.taskseries, false);
    }
    else {
      alert("RTM API error");
    }
  });    
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
    createUnscheduledTask(listid, taskitem);
  }
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
          });
        }
      }, 200);
    });
  }

  $( "#newtaskbtn" ).button().click(function(event){
    createTask($("#newtasktext").val());
  });
  $('#newtasktext').keyup(function(event){
    if (event.keyCode === 13){
      createTask($("#newtasktext").val());
    }
  });
  $('#completetaskbtn').button().click(function(event){
    var data = $("#edittaskdialog").data();
    completeTask(data.calData, data.uiElement);
  });
  $('#deletetaskbtn').button().click(function(event){
    var data = $("#edittaskdialog").data();
    deleteTask(data.calData, data.uiElement);
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
            task : { id : _taskBeingDragged.event.rtmtaskid }
        });
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
      $("#edittaskdialog").dialog({ width : 400, height: 110, title: calEvent.title }).data({ calData: calEvent });
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
