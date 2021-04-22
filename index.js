const LaunchDarkly = require('launchdarkly-node-server-sdk');
const faker = require('faker')
const { LEVEL, MESSAGE } = require('triple-beam');
const winston = require('winston')
const chdar = require('chokidar') 
const {format} = require('util')
const {v4 : uuid} = require('uuid')
const blessed = require('blessed')
const contrib = require('blessed-contrib')

const {readFile} = require('fs').promises
const pkg = require('./package.json');
const { toNamespacedPath } = require('path');
const hostname = require('os').hostname()
const GRID_COLS = 24
const GRID_ROWS = 80
const USER_COUNT = GRID_COLS * GRID_ROWS
const Transport = require('winston-transport');
const { DH_CHECK_P_NOT_PRIME } = require('constants');


class CustomTransport extends Transport {
  constructor(opts) {
    super(opts);
    this._fn = opts.fn
    //
    // Consume any custom options here. e.g.:
    // - Connection information for databases
    // - Authentication information for APIs (e.g. loggly, papertrail,
    //   logentries, etc.).
    //
  }

  log(info, callback) {
    
    this._fn(`${(new Date()).toISOString()}} [${info[LEVEL]}]: ${info.message }`)
    // Perform the writing to the remote service

    callback();
  }
};


let exampleUsers = [{
  "key": uuid(),
  "name": "foo"
}]

function createWatcher() {
return watcher = chdar.watch('users.json', {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true
});
}

function generateUser() {
  const [firstName, lastName] = [faker.name.firstName(), faker.name.lastName()]
  const username = faker.internet.userName(firstName, lastName)
  const groups = ['admin', 'user', 'editor', 'reviewer', 'author']
  return {
    key: uuid(),
    email: faker.internet.email(username),
    username,
    name: `${firstName} ${lastName}`,
    firstName,lastName,
    ip: faker.internet.ip(),
    custom: {
      dob: faker.date.past(50, new Date("Sat Sep 20 1992 21:35:02 GMT+0200 (CEST)")),
      organization: `${faker.lorem.word()} ${faker.company.companySuffix()}`,
      country: faker.address.countryCode(),
      groups: faker.random.arrayElements(groups, faker.datatype.number({min: 1, max: 3})),
      app_version: pkg.version,
      app_name: pkg.name,
      app_hostname: hostname
    }
  }
}

function generateUsers() {
  const users = []
  while (users.length < USER_COUNT) {
    users.push(generateUser())
  }
  return users
}

const randomUsers = generateUsers()
async function refreshUsers() {
  const data = await readFile('./users.json', {encoding: 'utf8' })
  exampleUsers = JSON.parse(data)
  return exampleUsers.concat(randomUsers.slice(0, randomUsers.length - exampleUsers.length))
}

const screen = blessed.screen({
  smartCSR: true
});
const userBox = blessed.box({
  
  height: '50%',
  width: '50%',
  top: 0,
  left: 0,

  label: {
    text: "Example Users",
    side: 'left'
  },
})
const userTable = blessed.table({
  parent: userBox,
  fillCellBorders: true,
  scrollable: true,
  align: 'left',
  height: '50%',
  width:'100%',
  border: 'line',
  style: {

    header: {
      bold: true
    }
  }
});
const loggerBox = blessed.box({
  border: {
    type: 'line'
  },
  height: '50%',
  width: '50%',
  top: 0,
  right: 0,
  label: {
    text: "Log",
    side: 'left'
  },
})
const logger = blessed.log({height: 4,
  parent: loggerBox,
  position: {
}})
const rolloutBox = blessed.box({
  top: '50%',
  height: '50%',
  width: '100%',
  border: 'line',
  label: "Rollout",
  sendFocus: true,
  scrollable: true
  
})
const rolloutDisplay = blessed.text({
  parent: rolloutBox,
  tags: true,
})
rolloutDisplay.enableMouse()
screen.append(loggerBox)
screen.append(userBox)
screen.append(rolloutBox)
screen.enableMouse()
rolloutBox.focus()

const noop = (info, callback) => { 
  logger.log(info)
  if (callback) {
    callback()
  }
  screen.render()

}
const transport = new CustomTransport({fn: noop})
const ldLogger = winston.createLogger({
  transports: [transport]
})

const ld = LaunchDarkly.init(process.env.SDK_KEY, {
  logger: ldLogger,
  sendEvents: true
});
const variation = ld.variation.bind(ld)
async function render() {
  const users = await refreshUsers()
  const dummyUser = {key: "anonymous", anonymous: true}
  const flags = (await ld.allFlagsState(dummyUser)).allValues()
  const flagKeys = Object.keys(flags);
  const table = [['Flag'].concat(exampleUsers.map((user => user.name)))]
  const rows = (await Promise.all(flagKeys.map(key => Promise.all([key].concat(exampleUsers.map(user => ld.variation(key, user)
 )))))).map(([first, ...rest]) => [first, ...rest.map(v => v.toString())])
  
  table.push(...rows)
  userTable.setData(table)

  screen.render()
  const evals = await Promise.all(users.map(user => Promise.all([user, ld.variation('release-widget', user, false)])))
  
  rolloutDisplay.setContent(evals.map(([user, result]) =>  `${result ? '{green-fg}' : '{blue-fg}'}█{/}`).join(''))
  rolloutDisplay.render()
  screen.render()
  //console.log(table)

  
}
// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], async function(ch, key) {

  await ld.flush()
  await ld.close()
  process.exit(0)
});
async function main() {
  await ld.waitForInitialization();
  const watcher = createWatcher()
  render()
  watcher.on('change', () => {
    ldLogger.info('example users changed')
    render()
  })
  ld.on('update', () => {
    ldLogger.info('rules updated')
    render()
  })
}
main().catch(e => {throw e})
