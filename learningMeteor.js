log_entries = new Meteor.Collection("log_entries");

Session.set("log_client", "pi");

if (Meteor.isClient) {
  Meteor.subscribe('log_entries');

  Template.log.log_entries = function() {
    return log_entries.find({client: Session.get("log_client")});
  };
}

if (Meteor.isServer) {
  var require = __meteor_bootstrap__.require;
  
  var dgram = require('dgram'); // UDP / Datagram Sockets
  var net = require('net'); // And general networking
  //var glossyParser = Parse; //require('glossy').Parse; // Glossy = Syslog message parser

  var listenIP = '0.0.0.0';
  var port = 514;

  // Server class
  var Server = {
    // If it's ok to accept connections at the moment
    acceptConnections: false
  };

  /**
   * Set up the syslog listener
   */
  Server.setUpSyslogUDPListener = function() {

    // Create a UDP server
    var server = dgram.createSocket("udp4");

    var identifier = null;

    server.on("message", function(message, requestInfo) {
      // When was this message received?
      var received = String((new Date().getTime()));

      // TODO: Push to a queue and process after dropping privileges
      // Ignore if we shouldn't accept connections yet
      if( Server.acceptConnections!==true ) {
        return;
      }

      console.debug('Received data to UDP "' + identifier + '": ' + data);

      // Parse data from the string to a more useful format
      var parsed = parse(data); //glossyParser.parse(data);

      // Add the time received
      parsed.received = received;

      // Write parsed data to mongodb
      log_entries.insert({client:'pi', text: JSON.stringify(parsed)});
    });

    // Run once the server is bound and listening
    server.on("listening", function() {
      // Get the server's address information
      var addressInfo = server.address();

      // Update identifier, so it can be used for logging
      identifier = addressInfo.address + ':' + addressInfo.port;

      console.log('Syslog UDP server is listening to ' + identifier);
    });

    // If the syslog server socket is closed
    server.on("close", function() {
      console.log('Syslog UDP server socket closed');
    });

    // If the server catches an error
    server.on("error", function(exception) {
      console.error('Syslog UDP server caught exception: ' + exception);
    });

    // Next, we bind to the syslog port

    // If there is a listen IP, also give that to bind
    if(listenIP && listenIP!=='0.0.0.0' ) {
      server.bind(port, listenIP);

    // Otherwise, bind to all interfaces
    } else {
      server.bind(port);
    }
  };

  Server.acceptConnections = true;

  Server.setUpSyslogUDPListener();

/*
  Meteor.startup(function () {
    // code to run on server at startup
    log_entries.insert({client: "pi", text: "log entry1"});
    log_entries.insert({client: "pi", text: "log entry2"});
  });
*/

  Meteor.publish('log_entries', function() {
    return log_entries.find();
  });
}
