'use strict';

const config = require("./config")
const clientFromConnectionString = require('azure-iot-device-' + config.protocol).clientFromConnectionString;
const Message = require('azure-iot-device').Message;
const logobject = require("./logger")
const read = require("./read")
const connectionString = config.connectionString

let client = clientFromConnectionString(connectionString)

function SendSimulatedData() {
    let message = new Message(read.SimulatedData())
    if (config.starttelemetry === true) {
        client.sendEvent(message, printResultFor('send'));
        console.log("Sending message: " + message.getData());
    }  
} 

function SendSensorData() {
    let message = new Message(read.ReadData())
    if (config.starttelemetry === true) {
        client.sendEvent(message, printResultFor('send'));
        console.log("Sending message: " + message.getData());
    }
} 

function printResultFor(op) {
    return function printResult(err, res) {
        if (err) logobject.logger.info(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}

let connectCallback = function (err) {
    if (err) {
        logobject.logger.info('Could not connect: ' + err)
    } else {
        logobject.logger.info('Client ' + config.deviceid +  ' connected to the cloud')
        client.on('message', function (msg) {
            //console.log('Id: ' + ' Body: ' + msg.data);
            client.complete(msg, printResultFor('completed'));
        });
    }
}

// add all intervals in array as reference
let intervals = []
//start telemetry with default interval
let running_point = 0
function startTelemetry() {
    return new Promise((resolve, reject) => {
        running_point++
        let defaultinterval = setInterval(() => {
            if (config.sensorData == 'off') SendSimulatedData()
            else SendSensorData()
            resolve({message:'telemtry was started successfully'})
        }, config.defaultinterval)
        intervals.push(defaultinterval)
    })
}

//check if telemetry is running to avoid interval overlapping
function CheckIfTelemetryIsRunning (){
    if(running_point == 1) {
      return true
    }
}

//clear all inervals method
function clearintervals(){
    for (let i = 0; i < intervals.length; i++){
        clearInterval(intervals[i])
    }
}

// stop telemetry
function stopTelemtry() {
    clearintervals()
    running_point--
}

// put new interval based on plattform commands
function SetNewInterval (request){
    clearintervals()
    let newinterval = setInterval(function () { SendSensorData() }, request.payload )
    intervals.push(newinterval)
}

client.open(connectCallback);

 module.exports = {
    SetNewInterval,
    stopTelemtry,
    startTelemetry,
    CheckIfTelemetryIsRunning
}
