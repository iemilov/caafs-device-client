'use strict';

const url = require('url')

const config = require("./config")
const sys = require('util')
const exec = require('child_process').exec;


let commands = ["startTelemetry", "stopTelemetry", "reboot", "uploadLogs", "firmwareUpdate", "setNewInterval"]

// check if waiting command match to one command of the commands array
function CheckCommand (twincommand){
    let l = commands.length
    for (let i = 0; i<l; i++){
        if (twincommand == commands[i]) {
            return true
        }
    }
}

//helper function to execute reboot
function Reboot () {
    return new Promise( (resolve, reject) => {
        exec(config.reboot, (err, stdout, stderr) => {
            if (err) reject(err)
            else resolve(stdout)
        })
    })
}

// Function that download all new packages
function Update () {
    return new Promise( (resolve, reject) => {
        exec(config.update, (err, stdout, stderr) => {
            if (err) reject(err)
            else resolve(stdout)
        })
    })
}

// Function that implements the firmware upfgrade with a particular command
function Upgrade () {
    return new Promise( (resolve, reject) => {
        exec(config.upgrade, (err, stdout, stderr) => {
            if (err) reject(err)
            else resolve(stdout)
        })
    })
}


// Function that implements the 'downloadImage' from a secure uri, phase of the firmware update process.
// let downloadImage = function(wPackageUriVal) {
//     let promise = new Promise(function(resolve, reject){
//        setTimeout(function() {
//           console.log('simulate image download')
//           resolve({result:'some more data'})
//        }, 15000)
//     })
//     return promise;
//  }

// Implementation for the apply phase, which reports status after 
// completing the image apply.
//  let applyImage = function(val) {
//     let promise = new Promise(function(resolve, reject){
//        setTimeout(function() {
//           console.log('second method completed');
//           resolve({result:'some more results'})
//        }, 15000)
//     });
//     return promise;
//  }


module.exports = {
    //downloadImage,
    //applyImage,
    Update,
    Upgrade,
    Reboot,
    CheckCommand
}