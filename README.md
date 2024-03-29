# flag-term-demo

![screenshot](./screenshot.png)


- Creates 1920 fake users using faker
- Allows you to add custom users from users.json
- Displays the flag evaluations for custom users in a table
- Show logs from the launchdarkly SDK
- Automatically refreshes when rules or users.json change
- Evaluates a flag called `release-widget` for all custom+generated users
	- Evaluation results are displayed in a grid where the cell is either green (true) or blue (false)

You can demonstrate the determinism of rollouts by:

- Rolling out to 20% of users
- Rolling out to 50% of users
- Roll back to 20% of users
- Note that the grid looks the same at 20% each time

Tested on node v16

## Setup

```
npm install 
```

## Usage

```
export LD_SDK_KEY=sdk-abc-123
node .
```

## Controlling the UI

This demo is controlled by feature flags. The flags can be created using the launchdarkly terraform provider.

```
cd terraform
terraform apply
```

Be sure to set the following variables in terraform.tfvars

```
launchdarkly_access_token = "api-xyz"
launchdarkly_project_key = "term-demo"
launchdarkly_project_name = "Term Demo"
```