# from: regorus playground

package feature_flags

import rego.v1

# Check if feature is enabled for user
feature_enabled(feature_name) if {
    feature := data.features[feature_name]
    feature.enabled
    user_matches_criteria(feature)
}

user_matches_criteria(feature) if {
    not feature.criteria  # No criteria means enabled for all
}

user_matches_criteria(feature) if {
    feature.criteria.user_percentage
    user_hash := crypto.sha256(input.user_id)
    user_bucket := to_number(substring(user_hash, 0, 8), 16) % 100
    user_bucket < feature.criteria.user_percentage
}

user_matches_criteria(feature) if {
    feature.criteria.user_groups
    input.user_group in feature.criteria.user_groups
}

user_matches_criteria(feature) if {
    feature.criteria.beta_users
    input.user_id in feature.criteria.beta_users
}

# Get all enabled features for user
enabled_features[feature_name] if {
    some feature_name, _ in data.features
    feature_enabled(feature_name)
}