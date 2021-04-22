# flag-term-demo

![screenshot](./screenshot.png)


- Creates 1920 fake users using faker
- Allows you to add custom users from users.json
- Displays the flag evaluations for custom users in a table
- Show logs from the launchdarkly SDK
- Automatically refreshes when rules or users.json change
- Evaluates a flag called `release-widget` for all custom+generated users
	- Evaluation results are displayed in a grid where the cell is either green (true) or blue (false)

You can demonstrate the determism of rollouts by:

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
export SDK_KEY=sdk-abc-123
node .
```

