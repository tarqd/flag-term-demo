terraform {
  required_providers {
    launchdarkly = {
      source  = "launchdarkly/launchdarkly"
      version = "~> 2.0"
    }
  }
}

# Configure the LaunchDarkly provider
provider "launchdarkly" {
  access_token = var.launchdarkly_access_token
}

variable "launchdarkly_access_token" {
  type        = string
  sensitive   = true
  description = "LaunchDarkly access token"
}

variable "launchdarkly_project_key" {
  type        = string
  description = "LaunchDarkly project key"
  default     = "term-demo"
}
variable "launchdarkly_project_name" {
  type        = string
  description = "LaunchDarkly project name"
  default     = "Term Demo"
}


resource "launchdarkly_project" "term_demo" {
  name = var.launchdarkly_project_name
  key  = var.launchdarkly_project_key
  tags = ["managed-by-terraform"]
  environments {
    name             = "Production"
    key              = "production"
    color            = "FF0000"
    require_comments = true
    confirm_changes  = true
    approval_settings {
      required               = true
      can_review_own_request = true
    }
  }
  environments {
    name             = "Test"
    key              = "test"
    color            = "00FF00"
    require_comments = false
    confirm_changes  = false
  }
  default_client_side_availability {
    using_environment_id = true
    using_mobile_key     = true
  }
}

resource "launchdarkly_feature_flag" "release_widget" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "release-widget"
  name           = "Release: Widget"
  description    = "Controls availabiity of the Widget component. Requires backend API"
  variation_type = "boolean"
  tags           = ["early-access-program", "managed-by-product-team", "managed-by-frontend-team"]
  temporary      = true

  variations {
    name        = "Available"
    value       = true
    description = "Widget is available to users"
  }
  variations {
    name        = "Unavailable"
    value       = false
    description = "Widget is unavailable "
  }

  defaults {
    on_variation  = 1
    off_variation = 1
  }
}



resource "launchdarkly_feature_flag" "release_widget_backend" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "release-widget-backend"
  name           = "Release: Widget Backend"
  description    = "Controls availability of the Widget Backend APIs."
  variation_type = "boolean"
  tags           = ["managed-by-backend-team", "incident-response"]
  temporary      = true
  variations {
    name        = "Available"
    value       = true
    description = "Widget API is available to serve requests"
  }
  variations {
    name        = "Unavailable"
    value       = false
    description = "Widget API is unavailable. Requests will return 503"
  }

  defaults {
    on_variation  = 1
    off_variation = 1
  }
}


resource "launchdarkly_feature_flag" "config_log_verbosity" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "config-log-verbosity"
  name           = "Config: Log Verbosity"
  description    = "Controls the log verbosity of applications. Logs are aggregated in [$service](http://example.com/logs)"
  variation_type = "number"
  tags           = ["incident-response"]
  temporary      = false
  variations {
    name        = "Emergency"
    value       = 0
    description = "System is unusable"
  }
  variations {
    name        = "Alert"
    value       = 1
    description = "Action must be taken immediately. A condition that should be corrected immediately, such as a corrupted system database."
  }
  variations {
    name        = "Critical"
    value       = 2
    description = "Critical conditions"
  }
  variations {
    name        = "Error"
    value       = 3
    description = "Error conditions"
  }
  variations {
    name        = "Warning"
    value       = 4
    description = "Warning conditions"
  }
  variations {
    name        = "Notice"
    value       = 5
    description = "Normal but significant conditions\t. Conditions that are not error conditions, but that may require special handling."
  }
  variations {
    name        = "Info"
    value       = 6
    description = "Informational messages"
  }
  variations {
    name        = "Debug"
    value       = 7
    description = "Messages that contain information normally of use only when debugging a program."
  }

  defaults {
    on_variation  = 3
    off_variation = 3
  }
}


resource "launchdarkly_feature_flag" "allow_eap_widget" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "allow-eap-widget"
  name           = "Allow: Early Access Program : Widget"
  description    = "Allows Users to view and opt-in to the Widget Early Access Program"
  variation_type = "boolean"
  tags           = []
  temporary      = true
  variations {
    name        = "Allow Opt-In"
    value       = true
    description = "User will be able to see and opt in to this early access program. "
  }
  variations {
    name        = "Deny Opt-In"
    value       = false
    description = "User will be unable to opt-in to this early program. Users who are not already opted-in will be not see the access program."
  }

  defaults {
    on_variation  = 0
    off_variation = 1
  }
}




resource "launchdarkly_feature_flag" "config_table_cell_color" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "config-table-cell-color"
  name           = "Config: Table Cell Color"
  description    = "Controls the color of the cells in the Rollout Display Table"
  variation_type = "string"
  tags           = ["managed-by-presenter", "user-interface", "rollout-table"]
  temporary      = false
  variations {
    name        = "Green"
    value       = "green"
    description = ""
  }
  variations {
    name        = "Blue"
    value       = "blue"
    description = ""
  }
  variations {
    name        = "Red"
    value       = "red"
    description = ""
  }
  variations {
    name        = "Cyan"
    value       = "cyan"
    description = ""
  }
  variations {
    name        = "Yellow"
    value       = "yellow"
    description = ""
  }
  variations {
    name        = "Magenta"
    value       = "magenta"
    description = ""
  }
  variations {
    name        = "Black"
    value       = "black"
    description = ""
  }

  defaults {
    on_variation  = 0
    off_variation = 1
  }
}


resource "launchdarkly_feature_flag" "config_table_cell_symbol" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "config-table-cell-symbol"
  name           = "Config: Table Cell Symbol"
  description    = "Controls the symbol used in the Rollout Display table. Must be one character, preferably mono-width."
  variation_type = "string"
  tags           = ["managed-by-presenter", "user-interface", "rollout-table"]
  temporary      = false
  variations {
    name        = "Block"
    value       = "█"
    description = ""
  }
  variations {
    name        = "Happy"
    value       = "🙂"
    description = ""
  }
  variations {
    name        = "Sad"
    value       = "🙁"
    description = ""
  }
  variations {
    name        = "Sssh!"
    value       = "🤫"
    description = ""
  }
  variations {
    name        = "Party"
    value       = "🎉"
    description = ""
  }

  defaults {
    on_variation  = 0
    off_variation = 0
  }
}


resource "launchdarkly_feature_flag" "db_create_table_widget" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "db-create-table-widget"
  name           = "DB: Create Table: Widget"
  description    = "Serves true after the schema change is applied and the table is available for use "
  variation_type = "boolean"
  tags           = ["managed-by-dba"]
  temporary      = true
  variations {
    name        = "Table Available"
    value       = true
    description = "Table has been created and is ready for use in this environment"
  }
  variations {
    name        = "Table Unavailable"
    value       = false
    description = "Table is unavailable"
  }

  client_side_availability {
    using_environment_id = false
    using_mobile_key     = false
  }
  defaults {
    on_variation  = 0
    off_variation = 1
  }

}


resource "launchdarkly_feature_flag" "show_table_row" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "show-table-row"
  name           = "Show: Table Row"
  description    = "Controls which table rows are displayed in the demo"
  variation_type = "boolean"
  tags           = ["managed-by-presenter", "user-interface", "rollout-table"]
  temporary      = false
  variations {
    name        = "Show"
    value       = true
    description = "Row will be shown"
  }
  variations {
    name        = "Hide"
    value       = false
    description = "Row will be hidden"
  }

  defaults {
    on_variation  = 1
    off_variation = 1
  }
}

resource "launchdarkly_feature_flag" "show_user_table" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "show-user-table"
  name           = "Show: User Table"
  description    = "Controls if the user table is shown"
  variation_type = "boolean"
  tags           = ["managed-by-presenter", "user-interface", "rollout-table"]
  temporary      = false
  variations {
    name        = "Show"
    value       = true
    description = "Table will be shown"
  }
  variations {
    name        = "Hide"
    value       = false
    description = "Table will be hidden"
  }

  defaults {
    on_variation  = 0
    off_variation = 1
  }
}


resource "launchdarkly_feature_flag" "config_rollout_flag" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "config-rollout-flag"
  name           = "Config: Rollout Flag"
  description    = "Sets the flag displayed in the Rollout Table. Docs: <https://example.com/rollout-display-table#config-rollout-flag>"
  variation_type = "string"
  tags           = ["managed-by-presenter", "user-interface", "rollout-table"]
  temporary      = false

  variations {
    name        = "Release: Widget"
    value       = "release-widget"
    description = ""
  }

  variations {
    name        = "Release: Widget Backend"
    value       = "release-widget-backend"
    description = ""
  }

  defaults {
    on_variation  = 0
    off_variation = 0
  }
}

resource "launchdarkly_segment" "release_flags" {
  for_each    = toset(launchdarkly_project.term_demo.environments[*].key)
  project_key = launchdarkly_project.term_demo.key
  env_key     = each.value
  key         = "release-flags"
  name        = "Release Flags"
  description = "Flags that control the release of new features"
  tags        = ["managed-by-terraform"]

  rules {
    clauses {
      attribute    = "key"
      op           = "startsWith"
      values       = ["release-"]
      negate       = false
      context_kind = "flag"
    }
  }
}

resource "launchdarkly_segment" "widget_flags" {
  for_each    = toset(launchdarkly_project.term_demo.environments[*].key)
  project_key = launchdarkly_project.term_demo.key
  env_key     = each.value
  key         = "widget-flags"
  name        = "Widget Flags"
  description = "Flags that related to the widget feature"
  tags        = ["managed-by-terraform"]

  rules {
    clauses {
      attribute    = "key"
      op           = "contains"
      values       = ["-widget-"]
      negate       = false
      context_kind = "flag"
    }
  }
  rules {
    clauses {
      attribute    = "key"
      op           = "endsWith"
      values       = ["-widget"]
      negate       = false
      context_kind = "flag"
    }
  }
}

resource "launchdarkly_segment" "eap_widget" {
  for_each    = toset(launchdarkly_project.term_demo.environments[*].key)
  project_key = launchdarkly_project.term_demo.key
  env_key     = each.value
  key         = "eap-widget"
  name        = "Early Access Program: Widget"
  description = "Users who have opted in to the Widget Early Access Program"
  tags        = ["managed-by-terraform"]

  rules {
    clauses {
      attribute    = "eap-optin"
      op           = "in"
      values       = ["widget"]
      negate       = false
      context_kind = "user"
    }
  }
}

resource "launchdarkly_segment" "supported_browsers" {
  for_each    = toset(launchdarkly_project.term_demo.environments[*].key)
  project_key = launchdarkly_project.term_demo.key
  env_key     = each.value
  key         = "supported-browsers"
  name        = "Supported Browsers"
  description = "Users who are using supported browsers"
  tags        = ["managed-by-terraform"]

  rules {
    clauses {
      attribute    = "vendor"
      op           = "in"
      values       = ["chrome"]
      negate       = false
      context_kind = "browser"
    }
    clauses {
      attribute = "version"
      op        = "semVerGreaterThan"
      values    = ["84.0.0"]
    }
  }

  rules {
    clauses {
      attribute    = "id"
      op           = "in"
      values       = ["firefox"]
      negate       = false
      context_kind = "browser"
    }
    clauses {
      attribute = "version"
      op        = "semVerGreaterThan"
      values    = ["89.0.0"]
    }
  }

}

resource "launchdarkly_feature_flag_environment" "release_widget_backend" {
  for_each = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id  = launchdarkly_feature_flag.release_widget_backend.id
  env_key  = each.value
  prerequisites {
    flag_key  = launchdarkly_feature_flag.db_create_table_widget.key
    variation = 0
  }
  on            = each.value != "production"
  off_variation = 1
  fallthrough {
    variation = 0
  }
}

resource "launchdarkly_feature_flag_environment" "release_widget" {
  for_each = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id  = launchdarkly_feature_flag.release_widget.id
  env_key  = each.value
  prerequisites {
    flag_key  = launchdarkly_feature_flag.release_widget_backend.key
    variation = 0
  }
  on = true
  rules {
    description = "Internal release"
    clauses {
      context_kind = "user"
      attribute    = "groups"
      op           = "in"
      values       = ["staff"]
    }
    variation = 0
  }
  rules {
    description = "Supported browsers only"
    clauses {
      attribute = "segmentMatch"
      op        = "segmentMatch"
      values    = [launchdarkly_segment.supported_browsers[each.key].key]
      negate    = true
    }
    variation = 1
  }

  off_variation = 1
  fallthrough {
    variation = 1
  }
}

resource "launchdarkly_feature_flag_environment" "allow_eap_widget" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.allow_eap_widget.id
  env_key       = each.value
  on            = false
  off_variation = 1
  fallthrough {
    variation = 0
  }
}

resource "launchdarkly_feature_flag_environment" "config_table_cell_color" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.config_table_cell_color.id
  env_key       = each.value
  on            = true
  off_variation = 5
  rules {
    description = "Boolean flags / false"
    clauses {
      context_kind = "flag"
      attribute    = "value"
      op           = "in"
      value_type   = "boolean"
      values       = [false]
    }
    variation = 1
  }
  rules {
    description = "Boolean flags / true"
    clauses {
      context_kind = "flag"
      value_type   = "boolean"
      attribute    = "value"
      op           = "in"
      values       = [true]
    }
    variation = 0
  }

  fallthrough {
    rollout_weights = [0, 0, 25000, 25000, 25000, 25000, 0]
    context_kind    = "flag"
    bucket_by       = "value"
  }
}

resource "launchdarkly_feature_flag_environment" "config_table_cell_symbol" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.config_table_cell_symbol.id
  env_key       = each.value
  on            = true
  off_variation = 0
  fallthrough {
    variation = 0
  }
}

resource "launchdarkly_feature_flag_environment" "db_create_table_widget" {
  for_each = toset(launchdarkly_project.term_demo.environments[*].key)

  flag_id       = launchdarkly_feature_flag.db_create_table_widget.id
  env_key       = each.value
  on            = true
  off_variation = 1
  fallthrough {
    variation = 0
  }
}

resource "launchdarkly_feature_flag_environment" "config_log_verbosity" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.config_log_verbosity.id
  env_key       = each.value
  on            = true
  off_variation = 3
  fallthrough {
    variation = 3
  }
}

resource "launchdarkly_feature_flag_environment" "show_table_row" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.show_table_row.id
  env_key       = each.value
  on            = true
  off_variation = 1
  rules {
    description = "Release Widget Flags"
    clauses {
      context_kind = "flag"
      op           = "segmentMatch"
      attribute    = "segmentMatch"
      values       = [launchdarkly_segment.widget_flags[each.key].key]
    }
    clauses {
      context_kind = "flag"
      op           = "segmentMatch"
      attribute    = "segmentMatch"
      values       = [launchdarkly_segment.release_flags[each.key].key]
    }
    variation = 0
  }
  fallthrough {
    variation = 1
  }
}

resource "launchdarkly_feature_flag_environment" "config_rollout_flag" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.config_rollout_flag.id
  env_key       = each.value
  on            = true
  off_variation = 0
  fallthrough {
    variation = 0
  }
}

resource "launchdarkly_feature_flag" "track_error_metric" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "track-error-metric"
  name           = "Track: Error Metric"
  description    = "Emulates errors when evaluating flags"
  variation_type = "json"
  tags           = ["demo", "metric"]
  temporary      = false
  variations {
    name = "Disable"
    value = jsonencode({
      enable : false,
    })
    description = "Metric will not be triggered"
  }
  variations {
    name = "Generic Error"
    value = jsonencode({
      enable : true,
      metric : "Error",
    })
    description = "Generate a generic error event"
  }


  defaults {
    on_variation  = 0
    off_variation = 0
  }
}


resource "launchdarkly_feature_flag" "track_latency_metric" {
  project_key    = launchdarkly_project.term_demo.key
  key            = "track-latency-metric"
  name           = "Track: Latency Metric"
  description    = "Emulates latency when evaluating flags"
  variation_type = "json"
  tags           = ["demo"]
  temporary      = false
  variations {
    name = "Disable"
    value = jsonencode({
      enable : false,
    })
    description = "Metric will not be triggered"
  }
  variations {
    name = "Low Latency"
    value = jsonencode({
      enable : true,
      metric : "Latency Milliseconds",
      faker : {
        module : "number",
        kind : "float",
        options : {
          min : 20,
          max : 500
        }

      }
    })
  }
  variations {
    name = "High Latency"
    value = jsonencode({
      enable : true,
      metric : "Latency Milliseconds",
      faker : {
        module : "number",
        kind : "float",
        options : {
          min : 800,
          max : 1200
        }
      }
    })
  }


  defaults {
    on_variation  = 0
    off_variation = 0
  }
}

resource "launchdarkly_feature_flag_environment" "track_error_metric" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.track_error_metric.id
  env_key       = each.value
  on            = false
  off_variation = 0
  # enable if the flag key is release-widget-backend in a rule clause
  rules {
    description = "Release Widget Backend Errors"
    clauses {
      context_kind = "flag"
      attribute    = "key"
      op           = "in"
      values       = [launchdarkly_feature_flag.release_widget_backend.key]
    }
    # percentage rollout by user
    rollout_weights = [
      90 * 1000,
      10 * 1000
    ]
  }
  # errors for frontend
  rules {
    description = "Release Widget Errors"
    clauses {
      context_kind = "flag"
      attribute    = "key"
      op           = "in"
      values       = [launchdarkly_feature_flag.release_widget.key]
    }
    # percentage rollout by user
    rollout_weights = [
      90 * 1000,
      10 * 1000
    ]
  }
  fallthrough {
    variation = 0
  }
}

resource "launchdarkly_feature_flag_environment" "track_latency_metric" {
  for_each      = toset(launchdarkly_project.term_demo.environments[*].key)
  flag_id       = launchdarkly_feature_flag.track_latency_metric.id
  env_key       = each.value
  on            = false
  off_variation = 0
  # enable if the flag key is release-widget-backend in a rule clause
  rules {
    description = "Release Widget Backend Latency"
    clauses {
      context_kind = "flag"
      attribute    = "key"
      op           = "in"
      values       = [launchdarkly_feature_flag.release_widget_backend.key]
    }
    # percentage rollout by user
    rollout_weights = [
      0 * 1000,
      80 * 1000,
      20 * 1000
    ]
  }

  fallthrough {
    variation = 0
  }
}
