const config = {}

// set the ednpoint for the device to connect to the IoT Hub. 
//You can get this endpoint if you  send request to 'getendpoint' API from the plattform: url ?
config.connectionString = '<device connection string>'
config.deviceid = config.connectionString.split('DeviceId=').pop().split(';')[0]
config.protocol = 'amqp'

//set default sending interval. This sending interval could be changen if you execute setNewInterval method form the platform: URL
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
config.clientlog = 'set path to log file' //example /home/pi/client/clientlogs.txt

// commands which will be executed automaticly on receiveng methods from the cloud. DO NOT CHANGE!
config.reboot = 'sudo reboot'
config.update = 'sudo apt-get update'
config.upgrade = 'sudo apt-get -y dist-upgrade'

module.exports = config
