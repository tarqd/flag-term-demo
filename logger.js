const { Transform, pipeline } = require("stream");
const Transport = require("winston-transport");
const winston = require("winston");
const { LaunchDarklyTransportFilter, LD_CONTEXT } = require("./logger-transport");

const levels = {
  user: -1,
  emerg: 0,
  alert: 1,
  crit: 2,
  error: 3,
  warn: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

const file = new winston.transports.File({
  filename: "combined.log",
  name: "file",
});

const ldTransport = new LaunchDarklyTransportFilter({
  levels,
  defaultLevel: "debug",
  flagKey: "config-log-verbosity",
});

ldTransport.pipe(file);

const logger = winston.createLogger({
  levels: levels,
  level: null,
  transports: [ldTransport],
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    //winston.format.colorize()
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      return `${timestamp} [${level}]: ${message} ${JSON.stringify(rest)}`;
    })
  ),
});

module.exports.logger = logger;
module.exports.levels = levels;
module.exports.setDefaultLogLevel = (level) =>
  (ldTransport.defaultLevel = level);
module.exports.getDefaultLogLevel = () => ldTransport.defaultLevel;
module.exports.setLoggerLDClient = (c) => ldTransport.setLDClient(c);
module.exports.LD_CONTEXT = LD_CONTEXT;
