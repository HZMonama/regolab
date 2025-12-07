# from: regorus playground

package data_filter

import rego.v1

# Filter sensitive data based on user role
filtered_data := result if {
    input.user_role == "admin"
    result := data.sensitive_data
} else := result if {
    input.user_role == "user"
    result := {k: v | 
        some k, v in data.sensitive_data
        not k in {"ssn", "salary", "internal_notes"}
    }
} else := {} if {
    input.user_role == "guest"
}

# Check what fields are allowed for a role
allowed_fields[field] if {
    input.user_role == "admin"
    some field in object.keys(data.sensitive_data)
}

allowed_fields[field] if {
    input.user_role == "user"
    some field in object.keys(data.sensitive_data)
    not field in {"ssn", "salary", "internal_notes"}
}