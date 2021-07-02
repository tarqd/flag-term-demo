const Transport = require('winston-transport');
const winston = require('winston')

const levels = {
    user: -1,
    emerg: 0, 
    alert: 1, 
    crit: 2, 
    error: 3, 
    warn: 4, 
    notice: 5, 
    info: 6, 
    debug: 7
};

const file = new winston.transports.File({ filename: 'combined.log', name: 'file' });
const logger = winston.createLogger({
    levels: levels,
    level: 'warn',
    transports: [
      file
    ],
    format: winston.format.combine(winston.format.splat(), winston.format.simple())
  });


module.exports.logger = logger;
module.exports.levels = levels;