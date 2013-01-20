syslogviewer
============

- receives syslog messages at udp port 514 and displays them with live update in browser including filtering options

@requires meteor (meteor.com)

example configuration for syslog daemon
=======================================

- add the following line in the /etc/rsyslog.conf file for sending messages to remote server
(for rsyslog, other implementations may have other config files)

*.*;auth,authpriv.none  	@192.168.1.103

- restart daemon
 
sudo /etc/init.d/rsyslog restart
