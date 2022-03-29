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
const {logger, LD_USER} = require('./logger')
const {withLDUser} = require('./logger-transport')
const { variation, variationDetail, variationMap} = example
const {getUser} = require('./user-generator')
const {mergeLDUser, sessionContext, userContext, serviceContext} = require('./ld-user')


// make the "random" users repeatable 
faker.seed(0x2BBA76D0)
const demos = DEMO && DEMO.split(',').map(v => v.trim()) || null


let exampleUsers = [{
  "key": uuid(),
  "name": "foo"
}]



function createWatcher(file) {
return watcher = chdar.watch(file, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true
});
}


function generateUsers() {
  const users = []
  while (users.length < USER_COUNT) {
    users.push(getUser())
  }
  return users
}

const randomUsers = generateUsers()
let didEAPs = false;

async function refreshUsers() {
  
  try {
    const data = await readFile('./users.json', {encoding: 'utf8' })
    exampleUsers = JSON.parse(data)
  } catch (e) {
    logger.error('failed to parse users.json')
  }
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
  tags: true,
  align: 'left',
  height: '30%',
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

const allFlagKeys = new Set()

let demoConfig = {};


async function getFlagKeysForTable() {
  const defaultFlags = ['release-widget', 'release-widget-api', 'release-widget-backend'];
  const flagKeys = []
  for (const key of allFlagKeys) {
    const ldUser = demoService("table",{
      "Flag Key": key
    })

    const isDefaultFlag = defaultFlags.includes(key)

    if (await variation('show-table-row',ldUser, isDefaultFlag)) {
        flagKeys.push(key)
      }
  }
  return flagKeys
}

function demoService(name="app",custom={}) {
  return serviceContext(name, Object.assign({}, custom, {"Demo": demos}, demoConfig))
}
function demoContext(custom) {
  return demoService("app", custom)
}

async function render() {
  const config = example.getConfig()
  const logger = example.serviceLogger('render')
  
  

  const users = await refreshUsers()
   
  const flagKeys = await getFlagKeysForTable()
 
 
  const tableLogger = example.serviceLogger('table')
  const table = [['Flag'].concat(exampleUsers.map((user => user.name)))]
  for (const flagKey of flagKeys) {
    const row = [`{bold}${flagKey}{/bold}`]
    for await (const user of exampleUsers) {
      const detail = variationDetail(flagKey, userContext(user))

    }
  }

  const rows = (await Promise.all(
    flagKeys.map(key => 
      Promise.all(
        [`{bold}${key}{/bold}`].concat(
          exampleUsers.map(async (user) => {
            user = userContext(user)
            const detail = await variationDetail(key, user)
            
            logger.debug('table: evaluated flag', {
              [LD_USER]: user,
               name: user.name,
               key: user.key,
               flag: key,
               ...detail
              })
              const type = typeof detail.value
              const context = {
                'Flag Key': key,
                'Flag Value': detail.value,
                'Flag Type': type == 'object' ? 'json' : type,
                'Evaluation Reason': detail.reason,
                "Demo: User Key": user.key
              };
              const str = JSON.stringify(detail.value)
            const color = await variation('config-table-cell-color', mergeLDUser(user, demoContext(context)), detail.value ? 'green' : 'blue')
            logger.debug('table display: ', {
              [LD_USER]: user,
              str,
              color,
              key: user.key,
              name: user.name
            })
            return `{${color}-fg}${str}{/}`
          })
      ))
      )))
    .map(
      ([first, ...rest]) => [first, ...rest.map(
        v => 
          v
        )
      ]
    )
  
  table.push(...rows)
 
  if (await variation('show-table-row', demoContext({'Calculated Row': 'Available EAPs'}), false)) {
    const eaps = await Promise.all(exampleUsers.map(user => example.getAvailableEarlyAccessPrograms(user)))
    table.push(['available eaps'].concat(eaps.map(v => v.join(','))))
  }
  userTable.setData(table)

  
  screen.render()
  const rolloutFlag = await variation('config-rollout-flag', demoContext(), 'release-widget')
  rolloutBox.setLabel(`${"\033"}[1m${rolloutFlag}${"\033"}[0m`)
  const evals = await Promise.all(users.map(async (user) => {
    const detail = await variationDetail(rolloutFlag, userContext(user))
    logger.debug('rollout: evaluated flag: ', {
      name: user.name,
      key: user.key,
      flag: rolloutFlag,
      [LD_USER]: mergeLDUser(demoContext(), userContext(user)), ...detail
    }
    )
    return [user, detail.value]
  }))
  const renderedCells = await Promise.all(evals.map(async ([user, result]) => {
    const type = typeof result
    user = userContext(user)
    const context = {
      'Flag Key': rolloutFlag,
      'Flag Value': result,
      'Flag Type': type == 'object' ? 'json' : type,
      "Demo: User Key": user.key
    };

    const colorKey = 'config-table-cell-color'
    
    
    const symbolKey = 'config-table-cell-symbol'

    const {[colorKey]: color, [symbolKey]: symbol} = await variationMap(mergeLDUser(user, demoContext(context)), {
      [colorKey]: !!result ? 'green' : 'blue',
      [symbolKey]: '█'
    })


    return `{bold}{${color}-fg}${symbol}{/}{/bold}`
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

async function refreshDemoConfig() {
    const logger = example.serviceLogger('config')
    try {
      const data = JSON.parse(await readFile('./demo.json', {encoding: 'utf8' }))
      demoConfig = data
      logger.debug('updated demo config', data)
      render()
    } catch (e) {
      logger.error('failed to parse demo.json', e)
    }
  
}

async function main() {


  ld.on('update', ({key}) => {
    // keep track of our flag keys
    allFlagKeys.add(key)
    render()
  })
  await ld.waitForInitialization();
  refreshDemoConfig()
  const userWatcher = createWatcher('users.json')
  const configWatcher = createWatcher('demo.json')
  userWatcher.on('change', () => {
    example.serviceLogger('config').debug('user json change detected')
    logger.debug('user json change detected')
    render()
  })
  configWatcher.on('change',() => {
    example.serviceLogger('config').debug('demo json change detected')
    refreshDemoConfig()
  })

}
main().catch(e => {throw e})
