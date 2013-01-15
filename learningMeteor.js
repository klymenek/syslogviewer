log_entries = new Meteor.Collection("log_entries");

//session based filter params for logs 
Session.set("log_client", "10.1.200.220");
Session.set("log_type", "<150>"); //TODO ???

if (Meteor.isClient) {
  Meteor.subscribe('log_entries');

  Template.log.log_entries = function() {
    return log_entries.find({client: Session.get("log_client")}, {sort: {received:-1}, limit: 50});
  };
}

if (Meteor.isServer) {
  var require = __meteor_bootstrap__.require;  
  var dgram = require('dgram'); // UDP/Datagram Sockets
  //var glossyParser = Parse; //require('glossy').Parse; // Glossy = Syslog message parser

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
	
	      console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
	      
	      // TODO glossy as syslog parser
	      // Parse data from the string to a more useful format
	      //var parsed = parse(msg); //glossyParser.parse(data);
	
	      // Add the time received
	      //parsed.received = received;
	      
	      var data = msg.toString();
	
	      // Write parsed data to mongodb
	      // TODO check for best practice
	      Fiber(function() {
		//log_entries.insert({client:'pi', text: JSON.stringify(msg)});
		log_entries.insert({client: rinfo.address, received: received, text: data});
	      }).run();
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
	    if(this.listenIP && this.listenIP!=='0.0.0.0' ) {
	      server.bind(this.port, this.listenIP);
	
	    // Otherwise, bind to all interfaces
	    } else {
	      server.bind(this.port);
	    }
    	}
  }

  Meteor.startup(function () {
    // code to run on server at startup
    Server.setUpSyslogUDPListener();
  });

  Meteor.publish('log_entries', function() {
    return log_entries.find();
  });
}
