const chdar = require('chokidar') 
const {format} = require('util')
const blessed = require('blessed')
const contrib = require('blessed-contrib')
const example = require('./example')
const {readFile} = require('fs').promises
const {v4: uuid} = require('uuid')
const faker = require('faker')
const pkg = require('./package.json')
const { DEMO } = process.env
const GRID_COLS = 24
const GRID_ROWS = 80
const USER_COUNT = GRID_COLS * GRID_ROWS
const demos = DEMO && DEMO.split(',').map(v => v.trim()) || []


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
let didEAPs = false;

async function refreshUsers() {
  const data = await readFile('./users.json', {encoding: 'utf8' })
  exampleUsers = JSON.parse(data)
  const randos = randomUsers.slice(0, randomUsers.length - exampleUsers.length);
  const key = 'EAP Opt-ins'
  if (!didEAPs) {
    for (const value of randos) {
      if (value.anonymous !== true && (value && value.custom && value.custom[key] == undefined)) { 
        const eaps = await example.getAvailableEarlyAccessPrograms(value)
        if (eaps.length > 0 && faker.datatype.number({min: 0, max: 100}) < 20) {
          didEAPs = true
          value.custom[key] = Array.from(eaps)
        }
      }
    }
  }

  return exampleUsers.concat(randos)
}

const screen = blessed.screen({
  smartCSR: true,
  fullUnicode: true
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
const loggerWindow = blessed.log({height: 4,
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
const { variation, variationMap} = example
const allFlagKeys = new Set()

async function render() {
  const config = example.getConfig()
  const cuser = (custom) => Object.assign({'key': `service/${pkg.name}`, "anonymous": true},{custom: Object.assign({'Demo': demos}, custom)})
  const dconfig = (key, context, fallback) => example.variation(key, cuser(context), fallback)
  const users = await refreshUsers()
  const flagKeys = (
    await Promise.all(Array.from(allFlagKeys).map(async (k) => {
    return [k,
            await dconfig('show-table-row', {
              'Flag Key': k
          }, k.startsWith('release-widget'))
        ]
  })))
    .filter(([k,v]) => v)
    .map(([k]) => k)
 
          
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
 
  if (await dconfig('show-table-row', {'Calculated Row': 'Available EAPs'}, false)) {
    const eaps = await Promise.all(exampleUsers.map(user => example.getAvailableEarlyAccessPrograms(user)))
    table.push(['available eaps'].concat(eaps.map(v => v.join(','))))
  }
  userTable.setData(table)

  
  screen.render()
  const rolloutFlag = await dconfig('configure-global-rollout-flag', {}, 'release-widget')
  rolloutBox.setLabel(`[ Rollout: ${rolloutFlag} ]`)
  const evals = await Promise.all(users.map(user => Promise.all([user, variation(rolloutFlag, user)])))
  const renderedCells = await Promise.all(evals.map(async ([user, result]) => {
    const type = typeof result
    const context = {
      'Flag Key': rolloutFlag,
      'Flag Value': result,
      'Flag Type': type == 'object' ? 'json' : type,
    };

    const colorKey = 'configure-table-cell-color'
    
    
    const symbolKey = 'configure-table-cell-symbol'

    const {[colorKey]: color, [symbolKey]: symbol} = await variationMap(cuser(context), {
      [colorKey]: !!result ? 'green' : 'blue',
      [symbolKey]: '█'
    })


    return `{${color}-fg}${symbol}{/}`
  }))
  
  rolloutDisplay.setContent(renderedCells.join(''))
  rolloutDisplay.render()
  screen.render()

  
}

screen.key(['escape', 'q', 'C-c'], async function(ch, key) {

  await ld.flush()
  await ld.close()
  process.exit(0)
});

async function main() {


  ld.on('update', ({key}) => {
    // keep track of our flag keys
    allFlagKeys.add(key)
    render()
  })
  await ld.waitForInitialization();
  const watcher = createWatcher()
  
  watcher.on('change', () => {
    render()
  })

}
main().catch(e => {throw e})
