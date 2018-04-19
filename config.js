const config = {}

// set the credentials for the device to connect to the IoT Hub
config.connectionString = 'HostName=GoIoT-ivan.azure-devices.net;DeviceId=myPi;SharedAccessKey=/lG5hbfctdskcDBJjmNflQ7Yp6CVteiPINt5HDTjg08='
config.deviceid = config.connectionString.split('DeviceId=').pop().split(';')[0]
config.protocol = 'amqp'

//set default sending interval
config.defaultinterval = 5000
config.starttelemetry = true
config.sensorData = 'on'  //if off simulated sensor data is generated and sent 
//sensor properties, example is based on dht sensor library with sensors type 22 and 11
// this app uses sensor type 22 for quering temperature and humidity values
config.sensors = [
//    {
//        type: 11,
//        pin: 4
//    },
    {
        type: 22,
        pin: 4
    }
]
//set name for the log file uploaded to the cloud
config.logfile = 'logs.txt'
// set path to the local file to write all logs
config.clientlog = '/home/pi/client/clientlogs.txt'
config.reboot = 'sudo reboot'
config.update = 'sudo apt-get update'
config.upgrade = 'sudo apt-get -y dist-upgrade'


// add the device metadata that you already now about your device
config.MetaData = {
    'IsSimulatedDevice': 0,  // set it to 1 if the device is simulated
    'Manufacturer': 'Raspberry',
    'batteryOnBoard': false,
    'simCardModul': false,
    'bluetoothd': 5.43,
    'gpsModul':false,
    'wifiOnBoard':true
}

module.exports = config
