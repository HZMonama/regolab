#from: regorus playground

package kubernetes.admission

import rego.v1

# Deny pods without resource limits
deny[msg] if {
    input.request.kind.kind == "Pod"
    input.request.operation == "CREATE"
    not input.request.object.spec.containers[_].resources.limits
    msg := "Containers must have resource limits defined"
}

# Deny privileged containers
deny[msg] if {
    input.request.kind.kind == "Pod"
    input.request.object.spec.containers[_].securityContext.privileged
    msg := "Privileged containers are not allowed"
}

# Require specific labels
deny[msg] if {
    input.request.kind.kind == "Pod"
    input.request.operation == "CREATE"
    not input.request.object.metadata.labels.app
    msg := "All pods must have an 'app' label"
}

# Check image registry
deny[msg] if {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    not startswith(container.image, "registry.company.com/")
    msg := sprintf("Image %s is not from approved registry", [container.image])
}