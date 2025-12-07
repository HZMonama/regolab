# from: regorus playground

package firewall

import rego.v1

default action := "deny"

# Allow established connections
action := "allow" if {
    input.state == "established"
}

# Allow outbound web traffic
action := "allow" if {
    input.direction == "outbound"
    input.dest_port in {80, 443}
    input.protocol == "tcp"
}

# Allow SSH from admin networks
action := "allow" if {
    input.dest_port == 22
    input.protocol == "tcp"
    input.source_ip in data.admin_networks
}

# Allow DNS
action := "allow" if {
    input.dest_port == 53
    input.protocol in {"tcp", "udp"}
}

# Block known bad IPs
action := "deny" if {
    input.source_ip in data.threat_ips
}

# Log high-risk traffic
log_required if {
    input.dest_port in data.sensitive_ports
}

log_required if {
    input.source_ip in data.monitored_ips
}