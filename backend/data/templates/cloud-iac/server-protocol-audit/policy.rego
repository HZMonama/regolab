# from: regorus playground

package example

default allow := false

allow if {
    count(violation) == 0
}

violation[server.id] if {
    some server
    public_server[server]
    server.protocols[_] == "http"
}

violation[server.id] if {
    server := input.servers[_]
    server.protocols[_] == "telnet"
}

public_server[server] if {
    some i, j
    server := input.servers[_]
    server.ports[_] == input.ports[i].id
    input.ports[i].network == input.networks[j].id
    input.networks[j].public
}