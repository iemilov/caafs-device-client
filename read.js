const sensorLib = require("node-dht-sensor");
const config = require("./config")
let count = 0


// read sensor data method
// it depends on the interface, sensor libraries or sensor types
// this method uses the dht sensor type and read temperature and humidity
function ReadData() {
    for (let a in config.sensors) {
        let b = sensorLib.read(config.sensors[a].type, config.sensors[a].pin)
	
        let data = JSON.stringify({
            deviceid: config.deviceid,
            temperature: b.temperature.toFixed(1),
            humidity: b.humidity.toFixed(1),
            message: count,
        })
        count = count + 1;
        return data
    }    
}

//generate simulated sensor data temperature, humidity and brighteness
function SimulatedData() {
    let temperature = 10 + (Math.random() * 10);
    let humidity = 10 + (Math.random() * 10);
    let brightness = 10 + (Math.random() * 10);
    let data = JSON.stringify({
        deviceID: config.deviceid,
        temperature: temperature,
        humidity: humidity,
        brightness: brightness,
        message: count
    })
    count = count + 1
    return data
}


module.exports = {
    ReadData,
    SimulatedData
}
