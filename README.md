syslogviewer
============

receives messages at udp port 514 and shows them live in browser with filtering options

requires meteor (meteor.com)

example configuration for syslog daemon
=======================================

add the following line in the /etc/rsyslog.conf file to send messages to remote server
(for rsyslog, other implementations may have other config files)

*.*;auth,authpriv.none  	@192.168.1.103

restart daemon with: sudo /etc/init.d/rsyslog restart
