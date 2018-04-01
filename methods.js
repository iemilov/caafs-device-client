'use strict';

require('es5-shim');
const config = require("./config")
const Client = require('azure-iot-device').Client;
const Protocol = require('azure-iot-device-mqtt').Mqtt
const settings = require("./send")
const helper = require("./helper")
const url = require('url')
const fs = require('fs')
const filePath = config.clientlog
const logobject = require("./logger")
const si = require('systeminformation')
let isconnected = false
let client = null;

let ExponentialBackOffWithJitter = require('azure-iot-common').ExponentialBackOffWithJitter;

let TimeoutError= function (err) {
    logobject.logger.error('TimeoutError ' +  err)
}

let UnauthorizedError= function (err) {
    logobject.logger.error('UnauthorizedError ' +  err)
}

let NotConnectedError= function (err) {
    logobject.logger.error('NotConnectedError ' +  err)
}

function main() {
    // open a connection to the device
    var deviceConnectionString = config.connectionString
    client = Client.fromConnectionString(deviceConnectionString, Protocol);
    client.open(onConnect)
    //client.setRetryPolicy(new ExponentialBackOffWithJitter(true, [TimeoutError, UnauthorizedError, NotConnectedError]));
}

// generic Device Management object for updating the device twin after methods trigger
let patch = {
    iothubDM : {
      firmwareUpdate : {},
      reboot : {},
      uploadLogs: {},
      startTelemetry: {},
      stopTelemetry:{},
      setNewInterval:{}
    }
}

// check and execute waiting command after update or offline modues
function GetAndExecuteWaitingCommands(twin) {
    if (twin.properties.desired.hasOwnProperty("WaitingCommand")) {
        let method = twin.properties.desired.WaitingCommand.commandId
        let reportedMethod = twin.properties.reported.iothubDM[method]
        let requestedTime = twin.properties.desired.WaitingCommand.CommandRequestTime
        let lastReportedTime = reportedMethod.lastExecuted

        if (helper.CheckCommand(method) && requestedTime > lastReportedTime) {
            if (method == 'startTelemetry') {
                settings.startTelemetry()
                    .then((result) => {
                        return reportThroughTwin("lastExecuted", "telemetry started", "starttelemetry")
                    })
            }
            if (method == 'stopTelemetry') {
                settings.stopTelemtry()
                return reportThroughTwin('lastExecuted', 'telemetry stopped', 'stoptelemetry')
            }
            if (method == 'setNewInterval') {
                settings.SetNewInterval(twin.properties.desired.WaitingCommand)
                return reportThroughTwin('lastExecuted', twin.properties.desired.WaitingCommand.payload + ' was last set', 'sendinginterval')
            }
            if (method == 'uploadLogs') {
                return UploadLogs()
            }
            if (method == 'firmwareUpdate') {
                return FirmwareUpdateCommand()
            }
            if (method == 'reboot') {
                return RebootDevice()
            }
        }
        else logobject.logger.info('there is no waiting command at this time')
    }
}

//helper function for genric response
function GenericResponse(request, response, message, ApiResponse) {
    response.send(ApiResponse, message, (err) => {
        if (!!err) {
            logobject.logger.error('An error ocurred when sending a method response:\n' +
                err.toString());
        } else {
            logobject.logger.info('Response to method \'' + request.methodName +
                '\' sent successfully.')
        }
    })
}

// helper function to report status to the cloud throught device twin
function reportThroughTwin(newkey, newstatus, activity) {

    if (activity == 'fw') {
        patch.iothubDM.firmwareUpdate['status'] = newstatus.text
        patch.iothubDM.firmwareUpdate['version'] = newstatus.version
        patch.iothubDM.firmwareUpdate[newkey] = new Date().toISOString()
    }
    if (activity == 'reboot') {
        patch.iothubDM.reboot['status'] = newstatus
        patch.iothubDM.reboot[newkey] = new Date().toISOString()
    }
    if (activity == 'upload') {
        patch.iothubDM.uploadLogs['status'] = newstatus
        patch.iothubDM.uploadLogs[newkey] = new Date().toISOString()
    }
    if (activity == 'starttelemetry') {
        patch.iothubDM.startTelemetry['status'] = newstatus
        patch.iothubDM.startTelemetry[newkey] = new Date().toISOString()
    }
    if (activity == 'stoptelemetry') {
        patch.iothubDM.stopTelemetry['status'] = newstatus
        patch.iothubDM.stopTelemetry[newkey] = new Date().toISOString()
    }
    if (activity == 'sendinginterval') {
        patch.iothubDM.setNewInterval['status'] = newstatus
        patch.iothubDM.setNewInterval[newkey] = new Date().toISOString()
    }

    return new Promise((resolve, reject) => {
        GetTwin()
            .then((twin) => {
                twin.properties.reported.update(patch, (err) => {
                    if (err) logobject.logger.error('Error updating twin')
                    else logobject.logger.info('Device twin state updated')
                })
                resolve(twin)
            })
    })
}

function GetTwin() {
    return new Promise((resolve, reject) => {
        client.getTwin((err, twin) => {
            if (err) reject(err)
            else {
                resolve(twin)
                logobject.logger.info('twin acquired')
            }
        })
    })
}

function onConnect(err) {
    if (!!err) {
	isconnected = false
        logobject.logger.error('Could not connect: ' + err.message)
    } else {
	isconnected = true
        logobject.logger.info('Connected to device. Registering handlers for methods.');
        // register handlers for all the method names we are interested in
        client.onDeviceMethod('setNewInterval', onSetNewInterval)
        client.onDeviceMethod('startTelemetry', onStartTelemetry)
        client.onDeviceMethod('stopTelemetry', onStopTelemetry)
        client.onDeviceMethod('uploadLogs', onUploadLogs)
        client.onDeviceMethod('reboot', onReboot)
        client.onDeviceMethod('firmwareUpdate', onFirmwareUpdate)
        client.onDeviceMethod('getMetadata', onGetMetadata)
        client.onDeviceMethod('monitor', onMonitor)

        GetTwin()
        .then((twin) => {
            // repoprt last reboot
            reportThroughTwin('LastRebootTime', 'reboot completed', 'reboot')
            .then(() => {
                //check and execute the last waiting command
                GetAndExecuteWaitingCommands(twin)
            })
        })

        client.on('disconnect',  () => {
	    isconnected = false
            logobject.logger.info('Device disconnetcted from the iot hub ' + new Date().toISOString())
            client.removeAllListeners()
            reconnect()
        })
    }
}

function reconnect() {
    let timeout = setInterval(() => {
	logobject.logger.info('RECONNECT is executed at ' + new Date().toISOString())
        main()
        if (isconnected) {
          clearInterval(timeout)
        }
    }, 10000)
}

//reconnect ()

// get dynamic data from device cpu load, processes and etc.
function onMonitor(request, response) {
    si.getDynamicData()
    .then((data) => {
        let message = data
        let ApiResponse = 200
        GenericResponse(request, response, message, ApiResponse)
    })
    .catch((error) => {
        let ApiResponse = 400
        GenericResponse(request, response, err, ApiResponse)
    })
}

// get static metadat from device
function onGetMetadata(request, response) {
    si.getStaticData()
    .then((data) => {
        let message = data
        let ApiResponse = 200
        GenericResponse(request, response, message, ApiResponse)
    })
    .catch((error) => {
        let ApiResponse = 400
        GenericResponse(request, response, error, ApiResponse)
    })
}

// listen to method uploadlogs
function onUploadLogs(request, response, err) {
    if (!err) {
        let message = "file uploaded started successfully"
        let ApiResponse = 200
        GenericResponse(request, response, message, ApiResponse)
        reportThroughTwin('uploadLogsStartTime', 'uploading', 'upload')
        logobject.logger.info(message);
        fs.stat(filePath, function (err, fileStats) {
            let fileStream = fs.createReadStream(filePath)
            client.uploadToBlob(config.logfile, fileStream, fileStats.size, (err) => {
                if (err) {
                    let error = 'error uploading file: ' + err.constructor.name + ': ' + err.message
                    let ApiResponse = 400
                    GenericResponse(request, response, error, ApiResponse)
                    reportThroughTwin('lastExecuted', 'upload error', 'upload')
                    logobject.logger.info(error)
                } else {
                    let message = "file uploaded successfully"
                    reportThroughTwin('lastExecuted', 'upload complete', 'upload')
                    logobject.logger.info(message)
                }
                fileStream.destroy()
            })
        })
    }
}

// execute this method if the command was on stanby
function UploadLogs(){
    fs.stat(filePath, function (err, fileStats) {
        let fileStream = fs.createReadStream(filePath)
        client.uploadToBlob(config.logfile, fileStream, fileStats.size, (err) => {
            if (err) {
                reportThroughTwin('lastExecuted', 'upload error', 'upload')
                logobject.logger.info(err.constructor.name + ': ' + err.message)
            } else {
                reportThroughTwin('lastExecuted', 'upload complete', 'upload')
                logobject.logger.info('file uploaded successfully')
            }
            fileStream.destroy()
        })
    }) 
}

function onSetNewInterval(request, response) {
    settings.SetNewInterval(request)
    reportThroughTwin('lastExecuted', request.payload + ' was last set', 'sendinginterval')
    let message = 'the new sending interval was set successfully'
    let ApiResponse = 200
    GenericResponse(request, response, message, ApiResponse)
}

function onStartTelemetry(request, response) {
    if (settings.CheckIfTelemetryIsRunning()) {
        let error = 'telemetry is already running'
        let ApiResponse = 400
        GenericResponse(request, response, error, ApiResponse)
    }
    else {
        settings.startTelemetry()
        .then((result) => {
            reportThroughTwin('lastExecuted', 'telemetry started', 'starttelemetry')
        })
        let message = 'telemtry was sterted successfully'
        let ApiResponse = 200
        GenericResponse(request, response, message, ApiResponse) 
    }
}

function onStopTelemetry(request, response) {
    settings.stopTelemtry()
    reportThroughTwin('lastExecuted', 'telemetry stopped', 'stoptelemetry')
    let message = 'telemetry was stoped successfully'
    let ApiResponse = 200
    GenericResponse(request, response, message, ApiResponse)
}

// listening to the device reboot method
function onReboot(request, response, err) {
    if (!err) {
        let message = 'Reboot started successfully'
        let ApiResponse = 200
        GenericResponse(request, response, message, ApiResponse)
        RebootDevice()
    }
    else {
        let error = 'Reboot error'
        let ApiResponse = 400
        GenericResponse(request, response, error, ApiResponse)
    }
}

// helper function to execute the device rebooting
function RebootDevice(){
    reportThroughTwin('lastExecuted', 'rebooting', 'reboot')
    .then(() => { 
        logobject.logger.info('rebooting physical device') 
        helper.Reboot()
        .catch((err) => { 
            logobject.logger.error('Error rebooting device')
            reportThroughTwin('startedRebootTime', 'error rebooting device', 'reboot')
        })
    })
    .catch((err) => { logobject.logger.error('Error reporting twin state') })
}

function onFirmwareUpdate(request, response, err) {
    if (!err && request.payload !== null) {
        let fwPackageUri = request.payload.fwPackageUri
        checkUrl(fwPackageUri, request, response)
    }
    else if (request.payload == null){
        let message = 'Firmware update started.'
        let ApiResponse = 200
        GenericResponse(request, response, message, ApiResponse)
        FirmwareUpdateCommand()
    }
    else {
        let error = 'Upgrade error'
        let ApiResponse = 400
        GenericResponse(request, response, error, ApiResponse)
    }
}

function FirmwareUpdateCommand(request, response, err) {
    helper.Update()
        .then((stdout) => {
            reportThroughTwin('startedDownloadingTime', {text:'downloading packages'}, 'fw')
            helper.Upgrade()
                .then((stdout) => {
                    reportThroughTwin('startedApplying', {text:'applying packages'}, 'fw')
                    si.osInfo()
                    .then((data) => {
                        reportThroughTwin('lastExecuted', {text:'firmware update completed', version:data.kernel}, 'fw')  
                    })
                    .catch(error => logobject.logger.error(error))
                })
                .catch(() => {
                    logobject.logger.error('Error starting upgrade packages')
                    reportThroughTwin('lastExecuted', {text:'applying packages error'}, 'fw')
                })
        })
        .catch(() => {
            logobject.logger.error('Error starting downloading packages')
            reportThroughTwin('lastExecuted', {text:'firmware upgrading error'}, 'fw')
        })
}

// helper function to check if url is secure and send result as response to the backend
// function checkUrl(fwPackageUri, request, response) {
//     let fwPackageUriObj = url.parse(fwPackageUri)
//     if (fwPackageUriObj.protocol !== 'https:') {
//         let error = 'Invalid URL format.  Must use https:// protocol.'
//         let ApiResponse = 400
//         GenericResponse(request, response, error, ApiResponse)
//     } else {
//         // Respond the cloud app for the device method
//         let message = 'Firmware update started.'
//         let ApiResponse = 200
//         GenericResponse(request, response, message, ApiResponse)
//         initiateFirmwareUpdateFlow(fwPackageUriObj)
//     }
// }

// method to initiate FW with downloading and applying image from provided uri
// function initiateFirmwareUpdateFlow(address) {
//     reportThroughTwin('startedDownloadingTime', 'downloading', 'fw')
//         .then(() => {
//             helper.downloadImage(address)
//             .then(() => {
//                 reportThroughTwin('downloadCompleteTime', 'download complete', 'fw')
//                 .then(() => {
//                     helper.applyImage('Apply image data')
//                     .then(() => {
//                         reportThroughTwin('startedApplyingImage', 'applying', 'fw')
//                             .then(() => { reportThroughTwin('lastFirmwareUpdate', 'apply firmware image complete', 'fw') })
//                     })
//                 })
//             })
//         })
//         .catch(() => { logobject.logger.error('Error reporting twin state') })
// }

module.exports = {
    main,
    reportThroughTwin,
    GetTwin,
    GetAndExecuteWaitingCommands
}
