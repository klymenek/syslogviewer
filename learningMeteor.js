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

  Template.chart_filter.rendered = function () {  
    var self = this;
   
    if (! self.handle) {
      self.handle = Meteor.autorun(function () {
        
        var reload = Session.get("reload");      
   
        //TEST DATA
        /*
          01010001,14,405,MCI,MDW
          01010530,-11,370,LAX,PHX
          01010540,5,389,ONT,SMF
          01010600,-5,337,OAK,LAX
          01010600,3,303,MSY,HOU
          01010605,5,236,LAS,LAX
          01010610,-4,405,MDW,MCI
          01010615,-2,188,RNO,SJC
          01010615,0,197,FLL,TPA
          01010615,0,399,SEA,BOI
        */
   
        var flights = [
          {date:"01010001", delay:14, distance:405},
          {date:"01010530", delay:-11, distance:370},
          {date:"01010540", delay:5, distance:389},
          {date:"01010600", delay:-5, distance:337},
        ];
        
        // A little coercion, since the CSV is untyped.
        flights.forEach(function(d, i) {
          d.index = i;
          d.date = parseDate(d.date);
          d.delay = +d.delay;
          d.distance = +d.distance;
        });
   
        // Like d3.time.format, but faster.
        function parseDate(d) {
          return new Date(2001,
              d.substring(0, 2) - 1,
              d.substring(2, 4),
              d.substring(4, 6),
              d.substring(6, 8));
        }
   
        // Create the crossfilter for the relevant dimensions and groups.
        var flight = crossfilter(flights),
            all = flight.groupAll(),
            date = flight.dimension(function(d) { return d3.time.day(d.date); }),
            dates = date.group(),
            hour = flight.dimension(function(d) { return d.date.getHours() + d.date.getMinutes() / 60; }),
            hours = hour.group(Math.floor),
            delay = flight.dimension(function(d) { return Math.max(-60, Math.min(149, d.delay)); }),
            delays = delay.group(function(d) { return Math.floor(d / 10) * 10; }),
            distance = flight.dimension(function(d) { return Math.min(1999, d.distance); }),
            distances = distance.group(function(d) { return Math.floor(d / 50) * 50; });
   
        var charts = [
   
          barChart()
              .dimension(hour)
              .group(hours)
            .x(d3.scale.linear()
              .domain([0, 24])
              .rangeRound([0, 10 * 24])),
   
          barChart()
              .dimension(delay)
              .group(delays)
            .x(d3.scale.linear()
              .domain([-60, 150])
              .rangeRound([0, 10 * 21])),
   
          barChart()
              .dimension(distance)
              .group(distances)
            .x(d3.scale.linear()
              .domain([0, 2000])
              .rangeRound([0, 10 * 40])),
   
          barChart()
              .dimension(date)
              .group(dates)
              .round(d3.time.day.round)
            .x(d3.time.scale()
              .domain([new Date(2001, 0, 1), new Date(2001, 3, 1)])
              .rangeRound([0, 10 * 90]))
              .filter([new Date(2001, 1, 1), new Date(2001, 2, 1)])
   
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
      });
    }
  };
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
