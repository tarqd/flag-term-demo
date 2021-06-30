const chdar = require('chokidar') 
const {format} = require('util')
const blessed = require('blessed')
const contrib = require('blessed-contrib')
const example = require('./example')
const {readFile} = require('fs').promises
const {v4: uuid} = require('uuid')

const GRID_COLS = 24
const GRID_ROWS = 80
const USER_COUNT = GRID_COLS * GRID_ROWS




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


function generateUsers() {
  const users = []
  while (users.length < USER_COUNT) {
    users.push(example.getUser())
  }
  return users
}

const randomUsers = generateUsers()

async function refreshUsers() {
  const data = await readFile('./users.json', {encoding: 'utf8' })
  exampleUsers = JSON.parse(data).map(example.getUser)
  return exampleUsers.concat(randomUsers.slice(0, randomUsers.length - exampleUsers.length))
}

const screen = blessed.screen({
  smartCSR: true
});
const userBox = blessed.box({
  
  height: '50%',
  width: '100%',
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
  label: "Rollout: release-widget",
  sendFocus: true,
  scrollable: true
  
})
const rolloutDisplay = blessed.text({
  parent: rolloutBox,
  tags: true,
})
rolloutDisplay.enableMouse()
//screen.append(loggerBox)
screen.append(userBox)
screen.append(rolloutBox)
screen.enableMouse()
rolloutBox.focus()

const noop = (info, callback) => { 
  //logger.log(info)
  if (callback) {
    callback()
  }
  screen.render()

}

const ld = example.getLDClient()
const variation = example.variation

async function render() {
  const users = await refreshUsers()
  const dummyUser = {key: "anonymous", anonymous: true}
  const flags = (await ld.allFlagsState(dummyUser)).allValues()
  const flagKeys = Object.keys(flags).filter(v => !v.startsWith('allow-early-access-program-'));
  const table = [['Flag'].concat(exampleUsers.map((user => user.name)))]
  const rows = (await Promise.all(
    flagKeys.map(key => 
      Promise.all(
        [key].concat(
          exampleUsers.map(user => ld.variation(key, user))
      ))
      )))
    .map(
      ([first, ...rest]) => [first, ...rest.map(v => v.toString())]
    )
  
  table.push(...rows)
  const eaps = await Promise.all(exampleUsers.map(user => example.getAvailableEarlyAccessPrograms(user)))
  table.push(['available eaps'].concat(eaps.map(v => v.join(','))))
  userTable.setData(table)

  screen.render()
  const evals = await Promise.all(users.map(user => Promise.all([user, variation('release-widget', user)])))
  
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
    render()
  })
  ld.on('update', () => {
    render()
  })
}
main().catch(e => {throw e})
