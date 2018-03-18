'use strict';

const config = require("./config")
const bunyan = require('bunyan')


let logger = bunyan.createLogger({
   name: 'app',
   streams: [
       {
           level: 'debug',
           stream: process.stdout  
       },
       {  
           level: 'info',
           path: config.clientlog 
       }
   ]
})


module.exports = {
    logger
}
