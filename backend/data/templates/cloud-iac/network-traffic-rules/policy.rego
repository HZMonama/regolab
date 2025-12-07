# from: regorus playground

package network

import rego.v1

# Allow internal network traffic
allow if {
    is_internal_network(input.source_ip)
    is_internal_network(input.dest_ip)
}

# Allow specific service communications
allow if {
    input.source_service in data.allowed_services[input.dest_service]
}

# Block suspicious traffic
deny if {
    input.source_ip in data.blocked_ips
}

deny if {
    input.dest_port in data.blocked_ports
}

is_internal_network(ip) if {
    net.cidr_contains("10.0.0.0/8", ip)
}

is_internal_network(ip) if {
    net.cidr_contains("192.168.0.0/16", ip)
}

# Rate limiting per IP
rate_limited if {
    count(data.recent_requests[input.source_ip]) > data.rate_limit
}