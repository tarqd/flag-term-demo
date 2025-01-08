const chdar = require("chokidar");
const { format } = require("util");
const blessed = require("blessed");
const contrib = require("blessed-contrib");
const example = require("./example");
const { readFile } = require("fs").promises;
const { v4: uuid } = require("uuid");
const { faker } = require("@faker-js/faker");
const pkg = require("./package.json");
const { DEMO } = process.env;
const GRID_COLS = 24;
const GRID_ROWS = 80;
let USER_COUNT = GRID_COLS * GRID_ROWS;
const { logger, LD_CONTEXT } = require("./logger");
const { withLDContext } = require("./logger-transport");
const { variation, variationDetail, variationMap, emulateMetrics } = example;
const { getUser } = require("./user-generator");
const {
  mergeLDContext,
  getContextKind,
  userContext,
} = require("./ld-context");
const { merge } = require("blessed/lib/helpers");
const { Writable } = require("node:stream");
const winston = require("winston");
const { get } = require("http");

// make the "random" users repeatable
faker.seed(0x2bba76d0);
const demos = (DEMO && DEMO.split(",").map((v) => v.trim())) || null;

let exampleContexts = [userContext({ name: "Example User", anonymous: true })];

function createWatcher(file) {
  return (watcher = chdar.watch(file, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
  }));
}

function generateUsers() {
  const users = [];
  while (users.length < USER_COUNT) {
    users.push(getUser());
  }
  return users;
}
// debounce fn 
function debounce(fn, delay) {
  let timeout;
  return function() {
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  }
}

let randomUsers = generateUsers();
let didEAPs = false;

async function refreshUsers() {
  try {
    const data = await readFile("./users.json", { encoding: "utf8" });
    exampleContexts = JSON.parse(data);
  } catch (e) {
    logger.error("failed to parse users.json");
  }

  while (randomUsers.length < USER_COUNT) {
    randomUsers.push(getUser());
  }
  
  const randos = randomUsers.slice(
    0,
    randomUsers.length - exampleContexts.length,
  );

  const key = "eap-optin";
  if (!didEAPs) {
    for (const context of randos) {
      const value = getContextKind("user", context);
      if (!value) continue;
      const eaps = await example.getAvailableEarlyAccessPrograms(context);
      if (eaps.length > 0 && faker.number.int({ min: 0, max: 100 }) < 20) {
        didEAPs = true;
        value[key] = Array.from(eaps);
      }
    }
  }

  return exampleContexts.concat(randos);
}

const screen = blessed.screen({
  smartCSR: true,
  fullUnicode: true,
});
const userBox = blessed.box({
  height: "50%",
  width: "100%",
  top: 0,
  left: 0,

  label: {
    text: "Example Users",
    side: "left",
  },
});
const userTable = blessed.table({
  parent: userBox,
  fillCellBorders: true,
  scrollable: true,
  tags: true,
  align: "left",
  height: "30%",
  width: "100%",
  border: "line",
  style: {
    header: {
      bold: true,
    },
  },
});
const loggerBox = blessed.box({
  border: "line",
  height: "50%",
  width: "50%",
  align: "right",
  right: 0,
  label: {
    text: "Log",
    side: "left",
  },
});
const loggerWindow = blessed.log({
  tags: true,
  keys: true,
  vi: true,
  mouse: true,
  scrollback: 100,
  scrollbar: {
    ch: " ",
    track: {
      bg: "yellow",
    },
    style: {
      inverse: true,
    },
  },
});
loggerBox.append(loggerWindow);
const rolloutBox = blessed.box({
  top: "50%",
  height: "50%",
  width: "100%",
  border: "line",

  label: "Rollout",
  sendFocus: true,
  scrollable: true,
});
const rolloutDisplay = blessed.text({
  parent: rolloutBox,
  tags: true,
});
rolloutDisplay.enableMouse();
screen.append(userBox);

//screen.append(loggerBox)

screen.append(rolloutBox);
screen.enableMouse();
rolloutBox.focus();



const noop = (info, callback) => {
  //logger.log(info)
  if (callback) {
    callback();
  }
  screen.render();
};

const ld = example.getLDClient();

const flushDebounced = debounce(async () => await ld.flush(), 1000);

const allFlagKeys = new Set();

let demoConfig = {};
const demoKey = uuid();

async function getFlagKeysForTable() {
  const defaultFlags = [
    "release-widget",
    "release-widget-api",
    "release-widget-backend",
  ];
  const flagKeys = [];
  for (const key of allFlagKeys) {
    const ldContext = demoContext({
      kind: "flag",
      key: key,
    });

    const isDefaultFlag = defaultFlags.includes(key);

    if (await variation("show-table-row", ldContext, isDefaultFlag)) {
      flagKeys.push(key);
    }
  }
  return flagKeys;
}

function demoContext(...contexts) {
  return mergeLDContext(
    {
      kind: "demo",
      key: demoKey,
      anonymous: !!demoConfig.name,
      ...demoConfig,
    },
    ...contexts,
  );
}

async function render() {
  if(!ld.initialized()) {
    return;
  }
  const config = example.getConfig();
  const logger = example.serviceLogger("render");
  USER_COUNT = rolloutBox.height * rolloutBox.width;
  const users = await refreshUsers();
  


  const flagKeys = await getFlagKeysForTable();

  const tableLogger = example.serviceLogger("render:table");
  const exampleUsers = exampleContexts
    .map((v) => getContextKind("user", v))
    .filter(Boolean);

  const table = [["Flag"].concat(exampleUsers.map((v) => v.name))];

  const rows = (
    await Promise.all(
      flagKeys.map((key) =>
        Promise.all(
          [`{bold}${key}{/bold}`].concat(
            exampleContexts.map(async (ctx) => {
              ctx = demoContext(ctx);
              const detail = await variationDetail(key, ctx);
              let user = getContextKind("user", ctx);
              logger.debug(
                "table: evaluated flag",
                withLDContext(
                  {
                    name: user.name,
                    key: user.key,
                    flag: key,
                    ...detail,
                  },
                  user,
                ),
              );

              const flagContext = {
                kind: "flag",
                key: key,
                value: detail.value,
                type: typeof detail.value,
                reason: detail.reason,
              };

              const str = JSON.stringify(detail.value);

              const color = await variation(
                "config-table-cell-color",
                demoContext(flagContext, ctx),
                detail.value ? "green" : "blue",
              );
              logger.debug("table display: ", {
                [LD_CONTEXT]: user,
                str,
                color,
                key: user.key,
                name: user.name,
              });
              return `{${color}-fg}${str}{/}`;
            }),
          ),
        ),
      ),
    )
  ).map(([first, ...rest]) => [first, ...rest.map((v) => v)]);

  table.push(...rows);
  const rowContext = demoContext({
    kind: "calculated-row",
    name: "Available EAPs",
    key: "available-eaps",
  });
  if (await variation("show-table-row", rowContext, false)) {
    const eaps = await Promise.all(
      exampleUsers.map((user) => example.getAvailableEarlyAccessPrograms(user)),
    );
    table.push(["available eaps"].concat(eaps.map((v) => v.join(","))));
  }
  userTable.setData(table);

  //screen.render()
  const rolloutFlag = await variation(
    "config-rollout-flag",
    demoContext(),
    "release-widget",
  );
  const emulationQueue = [];
  const variationCounts = [];
  const evals = await Promise.all(
    users.map(async (user) => {
      const context = demoContext(user);
      const detail = await variationDetail(rolloutFlag, context);
      false && logger.info(
        "rollout: evaluated flag: ",
        withLDContext(
          {
            name: user.name,
            key: user.key,
            flag: rolloutFlag,
          },
          context,
        ),
      );
      // do tracking
      const type = typeof detail.value;
      
      emulationQueue.push([context, {
        kind: "flag",
        key: rolloutFlag,
        value: detail.value,
        type: type == "object" ? "json" : type,
      }]);
      //logger.debug("queueing emulation", emulationQueue[emulationQueue.length - 1]);  
      /*await emulateMetrics(context, {
        kind: "flag",
        key: rolloutFlag,
        value: detail.value,
        type: type == "object" ? "json" : type,
      });*/
      
      if(detail.variationIndex !== null) {
        variationCounts[detail.variationIndex] = (variationCounts[detail.variationIndex] || 0) + 1;
      } 
      return [user, detail.value];
    }),
  );

  const variationSum = variationCounts.reduce((a, b) => a + b, 0);
  const variationPercentages = variationCounts.map((v) => Math.round((v / variationSum) * 100)).map(v => (v||0)+"%")
  rolloutBox.setLabel(`${"\x1b"}[1m${rolloutFlag}${"\x1b"}[0m [${USER_COUNT}] [${variationCounts.map(v => v || 0).join("/")}] [${variationPercentages.join("/")}]`);
  
  const renderedCells = await Promise.all(
    evals.map(async ([user, result]) => {
      const type = typeof result;
      const context = demoContext(
        {
          kind: "flag",
          key: rolloutFlag,
          value: result,
          type: type == "object" ? "json" : type,
        },
        user,
      );

      const colorKey = "config-table-cell-color";
      const bgColorKey = "config-table-cell-bg-color";

      const symbolKey = "config-table-cell-symbol";

      const { [colorKey]: color, [symbolKey]: symbol, [bgColorKey]: bgColor } = await variationMap(
        context,
        {
          [colorKey]: !!result ? "green" : "blue",
          [symbolKey]: "█",
          [bgColorKey]: "black",
        },
      );
      
      //throw new Error(`{bold\}{${color}-fg}{${bgColor}-bg}${symbol}{/${color}-fg}{/${bgColor}-bg}{/bold}`);
      return `{bold}{${bgColor}-bg}{${color}-fg}${symbol}{/${color}-fg}{/${bgColor}-bg}{/bold}`;
    }),
  );

  rolloutDisplay.setContent(renderedCells.join(""));
  screen.render();
  // save emulation for after render
  process.nextTick(async () => {
    return;
    flushDebounced();
    let count = 0;
    
    for (const [context,flagContext] of emulationQueue) {
    await emulateMetrics(context, flagContext);
    
    count = (count + 1) % 1000;
    if (count == 0) {
      logger.debug("early flush");
      await ld.flush();
      
    }
  }
    logger.debug("flushing after emulation", {count: emulationQueue.length});
    await ld.flush();
  });
}



screen.key(["escape", "q", "C-c"], async function (ch, key) {
  await ld.flush();
  await ld.close();
  process.exit(0);
});




async function refreshDemoConfig() {
  const logger = example.serviceLogger("config");
  try {
    const data = JSON.parse(
      await readFile("./demo.json", { encoding: "utf8" }),
    );
    demoConfig = data;
    logger.debug("updated demo config", data);
    render();
  } catch (e) {
    logger.error("failed to parse demo.json", e);
  }
}

async function main() {
  const blessedLogStream = new Writable({
    objectMode: false,
    write(chunk, encoding, callback) {
      //loggerWindow.log(chunk.toString().trim())
      callback();
    },
  });
  const transport = new winston.transports.Stream({
    stream: blessedLogStream,
  });
  logger.pipe(transport);

  ld.on("update", ({ key }) => {
    // keep track of our flag keys
    allFlagKeys.add(key);
    render();
  });
  const refreshLayout = async () => {
    logger.debug("refreshing layout");
    if(await variation("show-user-table", demoContext(), true)) {
      userBox.show();
      rolloutBox.top = "50%";
      rolloutBox.height = "50%";
      
    } else {
      userBox.hide();
      rolloutBox.top = "0%";
      rolloutBox.height = "100%";
    }
    render();
    
  }
  ld.on("update:show-user-table", refreshLayout);
  await refreshDemoConfig();
  await ld.waitForInitialization({
    timeoutSeconds: 10,
  });
  screen.on("resize", () => {
    if (rolloutBox.height * rolloutBox.width != USER_COUNT) {
      USER_COUNT = rolloutBox.height * rolloutBox.width;
      render();
    }
  });
  
  const userWatcher = createWatcher("users.json");
  const configWatcher = createWatcher("demo.json");
  userWatcher.on("change", () => {
    example.serviceLogger("config").debug("user json change detected");
    logger.debug("user json change detected");
    render();
  });
  configWatcher.on("change", async () => {
    example.serviceLogger("config").debug("demo json change detected");
    await refreshDemoConfig();
    refreshLayout();
  });
 
}
main().catch((e) => {
  throw e;
});
