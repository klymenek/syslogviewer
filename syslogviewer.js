TL = TLog.getLogger(TLog.LOGLEVEL_MAX,true);

log_entries = new Meteor.Collection("log_entries");

//session based filter params for logs
Session.set("log_client", "raspberrypi (192.168.1.102)");
Session.set("severity_filter", null);

if (Meteor.isClient) {
  Meteor.subscribe('log_entries');

  Template.log.log_entries = function() {
    //return log_entries.find({client: Session.get("log_client")}, {sort: {received:-1}, limit: 50});
    return log_entries.find({severity: Session.get("severity_filter")}, {sort: {received:-1}, limit: 50});
  };

  ////////// Severity Filter //////////

  Template.filter.severities = function () {
    var severity_infos = [];

    _.each(SeverityIndex, function(severity){
      severity_infos.push({severity: severity});
    });

    return severity_infos;
  };

  Template.filter.severity = function () {
    return this.severity || "All items";
  };

  Template.filter.selected = function () {
    return Session.equals('severity_filter', this.severity) ? 'selected' : '';
  };

  Template.filter.events({
    'mousedown .severity': function () {
      if (Session.equals('severity_filter', this.severity))
        Session.set('severity_filter', null);
      else
        Session.set('severity_filter', this.severity);
    }
  });

  ////////// Charts Filter //////////
/*
  Template.chart_filter.rendered = function () {
    var self = this;
   
    if (! self.handle) {
      self.handle = Meteor.autorun(function () {

        var reload = Session.get("reload");
        
        // retrieve all log entries
        var logs = log_entries.find({severity: Session.get("severity_filter")}).fetch();

        //var logs = log_entries.find({severity: Session.get("severity_filter")}, {sort: {received:-1}, limit: 50}).fetch();

        // add date property to logs
        logs.forEach(function(d, i) {
          d.date = new Date(+d.received);
        });
   
        // Create the crossfilter for the relevant dimensions and groups.
        var log = crossfilter(logs),
            all = log.groupAll(),
            date = log.dimension(function(d) { return d3.time.day(d.date); }),
            dates = date.group(),
            hour = log.dimension(function(d) { return d.date.getHours() + d.date.getMinutes() / 60; }),
            hours = hour.group(Math.floor);
   
        var charts = [
   
          barChart()
              .dimension(date)
              .group(dates)
              .round(d3.time.day.round)
            .x(d3.time.scale()
              .domain([new Date(2013, 0, 1), new Date(2013, 3, 1)])
              .rangeRound([0, 10 * 90]))
              .filter([new Date(2013, 1, 1), new Date(2013, 2, 1)]),

          barChart()
              .dimension(hour)
              .group(hours)
            .x(d3.scale.linear()
              .domain([0, 24])
              .rangeRound([0, 10 * 24]))
   
        ];
   
        // Given our array of charts, which we assume are in the same order as the
        // .chart elements in the DOM, bind the charts to the DOM and render them.
        // We also listen to the chart's brush events to update the display.
        var chart = d3.select("#charts").selectAll(".chart")
            .data(charts)
            .each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });
   
        renderAll();
   
        // Renders the specified chart or list.
        function render(method) {
          d3.select(this).call(method);
        }
   
        // Whenever the brush moves, re-rendering everything.
        function renderAll() {
          chart.each(render);
          //list.each(render);
          //d3.select("#active").text(formatNumber(all.value()));
        }

        window.filter = function(filters) {
          filters.forEach(function(d, i) { charts[i].filter(d); });
          renderAll();
        };

        window.reset = function(i) {
          charts[i].filter(null);
          renderAll();
        };
      });
    }
  };
  */

  Meteor.autosubscribe(function () {
        
        // retrieve all log entries
        var logs = log_entries.find({severity: Session.get("severity_filter")}).fetch();

        //var logs = log_entries.find({severity: Session.get("severity_filter")}, {sort: {received:-1}, limit: 50}).fetch();

        // add date property to logs
        logs.forEach(function(d, i) {
          d.date = new Date(+d.received);
        });
   
        // Create the crossfilter for the relevant dimensions and groups.
        var log = crossfilter(logs),
            all = log.groupAll(),
            date = log.dimension(function(d) { return d3.time.day(d.date); }),
            dates = date.group(),
            hour = log.dimension(function(d) { return d.date.getHours() + d.date.getMinutes() / 60; }),
            hours = hour.group(Math.floor);
   
        var charts = [
   
          barChart()
              .dimension(date)
              .group(dates)
              .round(d3.time.day.round)
            .x(d3.time.scale()
              .domain([new Date(2013, 0, 1), new Date(2013, 3, 1)])
              .rangeRound([0, 10 * 90]))
              .filter([new Date(2013, 1, 1), new Date(2013, 2, 1)]),

          barChart()
              .dimension(hour)
              .group(hours)
            .x(d3.scale.linear()
              .domain([0, 24])
              .rangeRound([0, 10 * 24]))
   
        ];
   
        // Given our array of charts, which we assume are in the same order as the
        // .chart elements in the DOM, bind the charts to the DOM and render them.
        // We also listen to the chart's brush events to update the display.
        var chart = d3.select("#charts").selectAll(".chart")
            .data(charts)
            .each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });
   
        renderAll();
   
        // Renders the specified chart or list.
        function render(method) {
          d3.select(this).call(method);
        }
   
        // Whenever the brush moves, re-rendering everything.
        function renderAll() {
          chart.each(render);
          //list.each(render);
          //d3.select("#active").text(formatNumber(all.value()));
        }

        window.filter = function(filters) {
          filters.forEach(function(d, i) { charts[i].filter(d); });
          renderAll();
        };

        window.reset = function(i) {
          charts[i].filter(null);
          renderAll();
        };
  });
}

if (Meteor.isServer) {
  var require = __meteor_bootstrap__.require;
  var dgram = require('dgram'); // UDP/Datagram Sockets

  // Syslog UDP Server
  var Server = {
    acceptConnections: true, // If it's ok to accept connections at the moment
    listenIP: "0.0.0.0",
    port: 514,
    setUpSyslogUDPListener: function() {
      // Create a UDP server
       var server = dgram.createSocket("udp4");

      var identifier = null;

      server.on("message", function(msg, rinfo) {
        // When was this message received?
        var received = String((new Date().getTime()));

        // TODO: Push to a queue and process after dropping privileges
        // Ignore if we shouldn't accept connections yet
        if( Server.acceptConnections!==true ) {
          return;
        }

        // Parse data from the string to a more useful format
        var parsed = Glossy.parse(msg);
        
        var data = msg.toString();

        // Write parsed data to mongodb
        // TODO check for best practice
        Fiber(function() {
          TL.verbose("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
        
          log_entries.insert({client: parsed.host + ' (' + rinfo.address + ')', received: received, time: parsed.time,
              facility: parsed.facility, severity: parsed.severity, message: parsed.message});
        }).run();
      });

      // Run once the server is bound and listening
      server.on("listening", function() {
        // Get the server's address information
        var addressInfo = server.address();

        // Update identifier, so it can be used for logging
        identifier = addressInfo.address + ':' + addressInfo.port;

        TL.info('Syslog UDP server is listening to ' + identifier);
      });

      // If the syslog server socket is closed
      server.on("close", function() {
        TL.info('Syslog UDP server socket closed');
      });

      // If the server catches an error
      server.on("error", function(exception) {
        TL.error('Syslog UDP server caught exception: ' + exception);
      });

      // Next, we bind to the syslog port

      // If there is a listen IP, also give that to bind
      if(this.listenIP && this.listenIP!=='0.0.0.0' ) {
        server.bind(this.port, this.listenIP);

      // Otherwise, bind to all interfaces
      } else {
        server.bind(this.port);
      }
    }
  };

  Meteor.startup(function () {
    // code to run on server at startup
    Server.setUpSyslogUDPListener();
  });

  Meteor.publish('log_entries', function() {
    return log_entries.find();
  });
}
